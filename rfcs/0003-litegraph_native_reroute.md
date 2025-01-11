# RFC: LiteGraph Native Reroute

- Start Date: 2025-01-12
- Target Major Version: TBD
- Reference Issues:

  - <https://github.com/Comfy-Org/litegraph.js/pull/301>
  - <https://github.com/Comfy-Org/ComfyUI_frontend/pull/1420>
  - <https://github.com/Comfy-Org/ComfyUI_frontend/pull/1421>

## Summary

This RFC proposes replacing ComfyUI's current frontend-only reroute node implementation with a native LiteGraph reroute feature. The new implementation will treat reroutes as link metadata rather than full nodes, providing several benefits:

- Simpler workflow JSON representation
- Proper type safety throughout connection chains
- Elimination of special-case handling for reroute nodes
- Reduced complexity in workflow structures and graph traversal

This change requires updates to both the workflow schema and LiteGraph.js library, with a migration path provided for existing workflows.

## Basic example

### New litegraph native reroute node

![new-reroute](https://github.com/user-attachments/assets/dddef61a-f975-4d69-b143-64505b6b9eaa)

![new-reroute-2](https://github.com/user-attachments/assets/c4c90291-38e6-429f-a22d-401848bb82d7)

Representation in workflow json (0.4 Schema):

```json
{
  "links": [
    [
      13,
      4,
      1,
      6,
      0,
      "CLIP"
    ]
  ],
  "extra": {
    "linkExtensions": [
      {
        "id": 13,
        "parentId": 3
      }
    ],
    "reroutes": [
      {
        "id": 2,
        "pos": [
          239.8215789794922,
          354.64306640625
        ],
        "linkIds": [
          13
        ]
      },
      {
        "id": 3,
        "parentId": 2,
        "pos": [
          309.733154296875,
          208.2829132080078
        ],
        "linkIds": [
          13
        ]
      }
    ]
  }
}
```

Representation in workflow json (1.0 Schema):

```json
{
  "links": [
    {
      "id": 13,
      "origin_id": 4,
      "origin_slot": 1,
      "target_id": 6,
      "target_slot": 0,
      "type": "CLIP",
      "parentId": 3
    }
  ],
  "reroutes": [
    {
      "id": 2,
      "pos": [
        239.8215789794922,
        354.64306640625
      ],
      "linkIds": [
        13
      ]
    },
    {
      "id": 3,
      "parentId": 2,
      "pos": [
        309.733154296875,
        208.2829132080078
      ],
      "linkIds": [
        13
      ]
    }
  ]
}
```

### Old frontend-only reroute node

![old-reroute](https://github.com/user-attachments/assets/03279c0b-cb3d-4668-afa4-3d8304814d67)

Representation in workflow json (0.4 & 1.0 Schema):

```json
{
  "links": [
    [
      11,
      4,
      1,
      10,
      0,
      "*"
    ],
    [
      12,
      10,
      0,
      6,
      0,
      "CLIP"
    ]
  ],
  "nodes": [
    {
      "id": 10,
      "type": "Reroute",
      "pos": [
        245.87435913085938,
        185.70533752441406
      ],
      "size": [
        75,
        26
      ],
      "flags": {},
      "order": 1,
      "mode": 0,
      "inputs": [
        {
          "name": "",
          "type": "*",
          "link": 11
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "CLIP",
          "links": [
            12
          ],
          "slot_index": 0
        }
      ],
      "properties": {
        "showOutputText": false,
        "horizontal": false
      }
    }
  ]
}
```

## Motivation

The current frontend-only reroute implementation has several limitations and drawbacks that this proposal aims to address:

1. **Graph Complexity**: The legacy reroute implementation adds unnecessary complexity to the workflow graph by creating additional nodes and links. Each reroute point requires a full node object with inputs/outputs and properties, which bloats the workflow JSON and makes graph traversal more complex.

2. **Type Safety Issues**: The current implementation uses wildcard type matching (`"*"`) for inputs, which bypasses LiteGraph's type checking system. This can lead to type inconsistency issues when connecting nodes, as the reroute node may connect incompatible types without proper validation.

3. **Implementation Overhead**: The legacy reroute implementation has resulted in numerous special-case handling throughout the codebase. Many features require specific patches to handle reroute nodes differently (checking `if (node.name === 'Reroute')`) which increases maintenance burden and makes the codebase more fragile. See <https://cs.comfy.org/search?q=context:global+%22%27Reroute%27%22&patternType=keyword&sm=0> for a list of patches.

By implementing reroutes as a native LiteGraph feature, we can:

- Simplify workflow representations by treating reroutes as link metadata rather than nodes
- Maintain proper type checking through the entire connection chain
- Eliminate the need for special-case handling of reroute nodes in various features
- Reduce the overall complexity of workflow JSON structures

## Detailed design

### Schema Changes

The native reroute implementation introduces a cleaner schema structure that moves reroute information out of the node list and into dedicated sections. The key changes between Schema 0.4 and 1.0 are:

1. **Link Structure**

  - 0.4: Links are arrays `[id, origin_id, origin_slot, target_id, target_slot, type]`
  - 1.0: Links are objects with named properties:

    ```
    {
      "id": number,
      "origin_id": number,
      "origin_slot": number,
      "target_id": number,
      "target_slot": number,
      "type": string,
      "parentId": number  // References parent reroute point
    }
    ```

2. **Reroute Structure**

  - 0.4: Reroutes are nested under `extra.reroutes`
  - 1.0: Reroutes are top-level array under `reroutes`

### Implementation Details

1. **Link Extension**

  - Each reroute point creates a virtual extension of the original link
  - Links maintain their original type throughout the reroute chain
  - Parent-child relationships between reroute points are tracked via `parentId`

2. **Position Management**

  - Reroute points store their canvas position as `[x, y]` coordinates
  - Multiple reroute points can be chained using the `parentId` reference
  - Each reroute point references its associated link(s) via `linkIds`

3. **Type Safety**

  - The link type is preserved from source to destination
  - No type conversion or wildcard matching occurs at reroute points
  - LiteGraph's native type checking remains active throughout the connection

### API Changes

The LiteGraph.js library will be extended with new methods:

```javascript
/**
 * Creates a new reroute and adds it to the graph.
 * @param pos Position in graph space
 * @param before The existing link segment (reroute, link) that will be after this reroute,
 * going from the node output to input.
 * @returns The newly created reroute - typically ignored.
 * Already implemented.
 */
LGraph.prototype.createReroute(pos: Point, before: LinkSegment): Reroute {
  ...
}

/**
 * Removes a reroute from the graph
 * @param id ID of reroute to remove
 * Already implemented.
 */
LGraph.prototype.removeReroute(id: RerouteId): void {
  ...
}

// New API endpoint (Refactor needed).
LGraphCanvas.prototype.renderReroutePoints = function() {
  // Handles visual rendering of reroute points
}
```

### Migration Path

To ensure a smooth transition, the migration strategy addresses both schema version changes and reroute implementation changes:

#### Schema Migration (0.4 to 1.0)

1. **Automatic Detection**: The system will automatically detect the schema version based on the link format (array vs object)

2. **Link Structure Conversion**:

```javascript
// Old format (0.4)
[13, 4, 1, 6, 0, "CLIP"]
// New format (1.0)
{ "id": 13, "origin_id": 4, "origin_slot": 1, "target_id": 6, "target_slot": 0, "type": "CLIP" }
```

1. **Reroute Location**: Reroutes will be moved from `extra.reroutes` to the top-level `reroutes` array

#### Legacy Reroute Migration

1. **Detection**: During workflow loading, the system will identify legacy reroute nodes by checking:

  - Node type === "Reroute"
  - Single input/output configuration
  - Presence in the `nodes` array

2. **Conversion Process**:

```javascript
// For each legacy reroute node:
   {
     // Create new native reroute point
     const reroute = {
       id: legacyNode.id,
       pos: legacyNode.pos,
       linkIds: [outputLink.id]
     };

     // Connect original input to final output
     const newLink = {
       id: generateNewId(),
       origin_id: inputLink.origin_id,
       origin_slot: inputLink.origin_slot,
       target_id: outputLink.target_id,
       target_slot: outputLink.target_slot,
       type: outputLink.type
     };

     // Remove old node and links.
     // Not fully connected legacy reroutes will be removed.
     removeNode(legacyNode);
     removeLinks([inputLink.id, outputLink.id]);
   }
```

1. **Validation**: After conversion, the system will verify:

  - Type consistency is maintained
  - All connections are preserved
  - Graph topology remains functional

#### Backwards Compatibility

- The system will maintain support for loading legacy reroute nodes throughout the targeted major version release cycle
- Warning messages will be displayed when legacy reroutes are detected
- Documentation will be updated to encourage migration to native reroutes

## Drawbacks

Several important considerations should be weighed before implementing this proposal:

1. **Implementation Complexity**
   - Requires significant modifications to the core LiteGraph.js library
   - Need to implement new rendering logic for reroute points
   - Complex migration logic needed to handle legacy reroute nodes
   - Additional testing burden to ensure compatibility across different workflow versions

2. **Breaking Changes**
   - Schema changes from 0.4 to 1.0 require all tools in the ecosystem to be updated
   - Third-party applications that directly manipulate workflow JSON will need modifications
   - Custom node implementations that interact with reroute nodes may break

3. **Performance Considerations**
   - Additional overhead in link rendering due to reroute point calculations
   - Increased memory usage from storing reroute metadata for each affected link
   - Potential impact on workflow loading times during migration

4. **User Experience Impact**
   - Users familiar with the current node-based reroute system will need to adapt
   - Documentation and tutorials will need significant updates
   - Temporary confusion during the transition period as both systems may coexist

5. **Alternative Approaches**
   - The current node-based implementation, while not ideal, is functional
   - Improvements to the existing system might be less disruptive than a complete redesign
   - User-space solutions might be sufficient for some use cases

6. **Maintenance Burden**
   - New code paths need long-term maintenance
   - Migration logic will need to be maintained for backward compatibility
   - Potential for new edge cases and bugs in the rerouting system

## Unresolved questions

1. **Unconnected Reroutes**: The current implementation in the litegraph library only allows reroutes to be created on existing links, which differs from the legacy reroute behavior that allowed unconnected reroutes. We need to determine:
   - Whether supporting unconnected reroutes is a necessary feature
   - If implemented, how would unconnected reroutes be represented in the schema
   - The potential impact on graph validation and type checking
   - Use cases where unconnected reroutes provide meaningful functionality
