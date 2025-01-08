# RFC: Workflow JSON Widget Values Format

- Start Date: 2025-01-08
- Target Major Version: TBD

## Summary

This RFC proposes a new format for handling widget values in ComfyUI workflows by integrating them directly into the node inputs array instead of storing them in a separate `widgets_values` array. The new format improves type safety, maintainability, and self-documentation of workflows by making each widget value a named, typed input with explicit metadata. This change will require a version bump in the workflow schema from 1.0 to 1.1, but includes backward compatibility measures to ensure a smooth transition for existing workflows and custom nodes.

## Basic example

![image](https://github.com/user-attachments/assets/e36113a9-20d6-406a-9a83-209c86b91107)

Current format node serialization format:

```json
{
  "id": 3,
  "type": "KSampler",
  "pos": [863, 186],
  "size": [315, 262],
  "flags": {},
  "order": 4,
  "mode": 0,
  "inputs": [
    { "name": "model", "type": "MODEL", "link": 1 },
    { "name": "positive", "type": "CONDITIONING", "link": 4 },
    { "name": "negative", "type": "CONDITIONING", "link": 6 },
    { "name": "latent_image", "type": "LATENT", "link": 2 },
    // Seed input converted from widget
    {
      "name": "seed",
      "type": "INT",
      "link": null,
      "widget": {
        "name": "seed"
      }
    }
  ],
  "outputs": [{ "name": "LATENT", "type": "LATENT", "links": [7], "slot_index": 0 }],
  "properties": {},
  "widgets_values": [156680208700286, true, 20, 8, "euler", "normal", 1]
}
```

Proposed format:

```json
{
  "id": 3,
  "type": "KSampler",
  "pos": [863, 186],
  "size": [315, 262],
  "flags": {},
  "order": 4,
  "mode": 0,
  "inputs": [
    { "name": "model", "type": "MODEL", "link": 1 },
    { "name": "positive", "type": "CONDITIONING", "link": 4 },
    { "name": "negative", "type": "CONDITIONING", "link": 6 },
    { "name": "latent_image", "type": "LATENT", "link": 2 },
    // Seed input converted from widget
    { "name": "seed", "type": "INT", "value": 156680208700286, "link": null },
    { "name": "denoise", "type": "FLOAT", "value": 1.0 },
    { "name": "steps", "type": "INT", "value": 20 },
    { "name": "cfg", "type": "FLOAT", "value": 8 },
    { "name": "sampler_name", "type": "COMBO", "value": "euler" },
    { "name": "scheduler", "type": "COMBO", "value": "normal" },
    { "name": "denoise", "type": "FLOAT", "value": 1.0 },
  ],
  "outputs": [{ "name": "LATENT", "type": "LATENT", "links": [7], "slot_index": 0 }],
  "properties": {},
}
```

## Motivation

The proposed format change addresses several key limitations in the current widget values implementation:

1. **Unified Input Handling**: By moving widget values into the inputs array, we create a single, consistent way to handle all node inputs. This simplifies the node processing logic and reduces the need for special-case handling of widget values versus connected inputs.

2. **Self-Describing Nodes**: The new format makes nodes more self-documenting by including input names and types directly in the node definition. This allows:

  - Reconstruction of node displays without requiring access to the full node definition
  - Better error checking and validation of values
  - Improved debugging capabilities
  - Easier serialization/deserialization of workflows

3. **Flexible Parameter Management**: The array-based structure of the current format makes it difficult to:

  - Insert new parameters in the middle of the list
  - Remove deprecated parameters
  - Maintain backward compatibility The named input approach solves these issues by making parameter order irrelevant.

4. **Type Safety**: Explicit type definitions for each input value helps prevent type-related errors and makes it easier to implement proper validation at both runtime and development time.

## Detailed design

### Schema Changes

The workflow schema will be updated from version 1.0 to 1.1 to accommodate the new widget values format. Here's the proposed Zod schema changes:

```typescript
// Version 1.1 Node Input Schema
const NodeInputV1_1 = z.object({
  name: z.string(),
  type: z.string(),
  link: z.number().optional(),
  value: z.any().optional(), // For widget values
});

// Version 1.1 Node Schema
const NodeV1_1 = z.object({
  id: z.number(),
  type: z.string(),
  pos: z.tuple([z.number(), z.number()]),
  size: z.tuple([z.number(), z.number()]),
  flags: z.record(z.any()),
  order: z.number(),
  mode: z.number(),
  inputs: z.array(NodeInputV1_1),
  outputs: z.array(NodeOutput),
  properties: z.record(z.any()),
  // widgets_values field removed
});
```

### Version Conversion

To maintain backward compatibility, the system will include bidirectional converters between versions:

```typescript
function convertTo1_1(nodeV1_0: NodeV1_0): NodeV1_1 {
  const widgetDefinitions = getNodeWidgetDefinitions(nodeV1_0.type);

  // Convert widget values to input format
  const widgetInputs = widgetDefinitions.map((def, index) => ({
    name: def.name,
    type: def.type,
    value: nodeV1_0.widgets_values[index]
  }));

  return {
    ...nodeV1_0,
    inputs: [...nodeV1_0.inputs, ...widgetInputs],
    widgets_values: undefined // Remove widget_values field
  };
}

function convertTo1_0(nodeV1_1: NodeV1_1): NodeV1_0 {
  const widgetDefinitions = getNodeWidgetDefinitions(nodeV1_1.type);
  const regularInputs = nodeV1_1.inputs.filter(input => !widgetDefinitions.find(def => def.name === input.name));
  const widgetValues = widgetDefinitions.map(def => {
    const input = nodeV1_1.inputs.find(i => i.name === def.name);
    return input?.value;
  });

  return {
    ...nodeV1_1,
    inputs: regularInputs,
    widgets_values: widgetValues
  };
}
```

### Workflow Export Options

When exporting workflows, users will be presented with schema version choices:

1. Latest Version (1.1) - Default
2. Legacy Version (1.0) - For compatibility with older systems (Beta Reroute)
3. Legacy Version (0.4) - For compatibility with older systems

The export dialog will include version selection and automatically convert the workflow to the selected format.

### Unknown Node Handling

For nodes without available definitions, LiteGraph will use the input metadata to render a basic representation:

1. Regular inputs will be rendered as connection points
2. Widget inputs will be rendered as appropriate UI controls based on their type:

  - INT/FLOAT -> Number input
  - STRING -> Text input
  - COMBO -> Dropdown (with available values if provided)
  - BOOLEAN -> Checkbox

```typescript
class LiteGraphNode {
  // ... existing code ...

  renderUnknownNode() {
    this.inputs.forEach(input => {
      if (input.link !== undefined) {
        // Render connection point
        this.addInput(input.name, input.type);
      } else if (input.value !== undefined) {
        // Render widget based on type
        this.addWidget(
          this.getWidgetTypeFromInputType(input.type),
          input.name,
          input.value,
          (v) => { input.value = v; }
        );
      }
    });
  }
}
```

This approach ensures that even unknown nodes remain editable and maintain their configuration, even if specialized behavior isn't available.

## Drawbacks

1. **Increased Storage Size**: The new format is more verbose due to including field names and types for each widget value, which will increase the size of saved workflow files. While modern storage and network capabilities make this a minor concern, it's worth noting for systems handling large numbers of workflows.

2. **Migration Complexity**: Existing workflows will need to be migrated to the new format, requiring:

  - Development of reliable conversion utilities
  - Testing of conversion edge cases
  - Potential maintenance of multiple format versions during transition
  - Additional documentation for handling legacy formats

3. **Performance Considerations**: The new format requires:

  - More complex parsing logic compared to simple array access
  - Additional memory usage due to storing metadata with each value
  - Potentially slower lookup times when accessing widget values (object property access vs array index)

4. **Backward Compatibility Challenges**: While the proposal includes conversion utilities, there may be:

  - Third-party tools that need updating
  - Custom node implementations that assume the array-based format
  - Existing scripts or automation that parse workflow files directly

5. **Learning Curve**: Users and developers familiar with the current array-based format will need to adapt to the new structure, potentially leading to initial confusion and requiring updates to documentation and tutorials.

Despite these drawbacks, the benefits of improved maintainability, type safety, and self-documentation likely outweigh these concerns in the long term.

## Adoption strategy

The transition to the new widget values format will be implemented through a phased approach to ensure smooth adoption:

1. **Version Support**

  - ComfyUI will support both 1.0 and 1.1 formats simultaneously during the transition period
  - The internal format will be 1.1, with automatic conversion happening at workflow load/save
  - All new features will target the 1.1 format

2. **Breaking Changes**

  - This is technically a breaking change, but will be implemented with backward compatibility
  - Existing workflows using the 1.0 format will continue to work through automatic conversion
  - Node developers will need to update their implementations to support the new format

3. **Migration Path**

  - For ComfyUI Users:

    - Existing workflows will be automatically converted when loaded
    - No manual intervention required
    - Option to export in legacy format for compatibility with older systems

  - For Node Developers:

    - Deprecation notices for direct `widgets_values` access
    - New helper functions for accessing widget values through the inputs array
    - Migration guide and examples provided in documentation
    - Grace period of 2-3 releases before removing `widgets_values` support

4. **Ecosystem Impact**

  - Code search shows only ~10 custom node repositories directly accessing `widget_values`
  - ComfyUI team can directly contribute fixes to these repositories
  - API clients and workflow manipulation tools will need modification
  - Web UI extensions may require updates for the new format
  - Compatibility layer will be provided during transition:

    ```javascript
    get widgets_values() {
      console.warn("Deprecated: accessing widgets_values directly. Please migrate to input values.");
      return this.inputs
        .filter(input => input.value !== undefined)
        .map(input => input.value);
    }
    ```

5. **Timeline**

  - Beta release with dual format support
  - 3-month transition period with both formats supported
  - Full migration to 1.1 format in next major version

## Unresolved questions

TBD
