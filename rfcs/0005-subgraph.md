# RFC: Subgraph

- Start Date: 2025-01-12
- Target Major Version: TBD
- Reference Issues:
  - https://github.com/Comfy-Org/ComfyUI_frontend/issues/1077
  - https://github.com/comfyanonymous/ComfyUI/issues/5353
  - https://github.com/comfyanonymous/ComfyUI/issues/4094
  - [... many more]
  - https://github.com/comfyanonymous/ComfyUI/issues/150

## Summary

Subgraphs separate sections of workflows (graphs) into distinct, logical entities. This separation provides re-usability and modularity, and can drastically reduce visual and cognitive complexity.

- A subgraph has its own inputs and outputs, which can be used to connect nodes on the parent graph to those in the subgraph.
- Subgraphs added to a graph multiple times only need to be edited once to update all instances

## Basic example

Simple design mock-ups.

### Main workflow

The parent / primary workflow, as opened normally.

![Parent workflow example](https://github.com/user-attachments/assets/255e5a43-fd7a-48b4-beb5-c9e8e09af4bd)

### Subgraph

The contents of the subgraph, as displayed after opening.

![Subgraph example](https://github.com/user-attachments/assets/b765ef67-3ac3-4ba0-90ba-0465471b970f)

## Motivation

The ComfyUI community has made several requests for this feature. In any workflow with more than a handful of nodes, subgraphs can significantly improve UX. Requests for subgraph-like features go back to at least March 2023.

1. **User experience**: This feature drastically improves UX when reading or editing even moderately-sized workflows.
2. **Reduced Complexity**: Subgraphs allow a reduction in visual and cognitive complexity by combining an entire section of a workflow into a single visual representation. This also supports mental partitioning of the sum effect of the subgraph.
3. **Re-usability & modularity**: A subgraph can be be added multiple times to a workflow, and to other workflows. By default, the subgraph will be linked rather than duplicated; editing a subgraph effectively updates all instances.
4. **Performance**: By visually combining groups of graph objects (e.g. nodes) into a single object, subgraphs remove soft-limits on workflow size due to performance limitations. Subgraphs linked multiple times can also reduce workflow export size, improving storage and parse/load times.

## Detailed design

A subgraph is a standard ComfyUI workflow with the addition of inputs and outputs. By extending the existing workflow management UI, some of the specifications will require only minor changes.

### Design requirements

- The exact same tools are used to edit a workflow & a subgraph
- Can open/edit subgraph instance or template in its own tab
- Can also open/edit subgraph in-place on a workflow, by double-click or similar
- Subgraphs embedded in an open workflow can be copied into the users’ workflow library
- Subgraphs always have two special, non-removable nodes: `Inputs` and `Outputs` (`ionodes`)
  - Ensure design does not prevent adding an option to hide these in the future
- Simple method to drop noodles onto `ionodes`, creating new in/out slots in the parent graph
  - Use existing UX when connecting links to a node with empty slots
  - Allow type reset of empty `ionode` slots via simple interaction
- Individual node widgets can be exposed directly as widgets in the parent graph
  - Highlighted / visually flagged in some fashion when viewed in the subgraph
- A panel that lists all inputs, outputs, and exposed widgets
  - Add / edit / remove
  - Widgets: Edit / remove, with add as a future milestone

### Connecting between graph and subgraph

```c
// Current: A node to node connection
Node output --> Node input

// Proposed: A node to subgraph node connection
// Workflow view
Node output --> Subgraph input
// Subgraph view
Subgraph input --> Subgraph node input
```

### Server API

Subgraphs are to be implemented as a frontend-only feature. When assembling a prompt to queue, the frontend will recursively flatten all subgraphs, effectively removing the subgraph from the serialised prompt.

A tuple of the node ID and subgraph instance ID will be mapped to a new unique identifier, to be used in API comms with the server.

### Subgraph library

Precise UI implementation details are not the intention of this section, and can be adapted and iterated with user feedback.

- Subgraphs will be stored alongside workflows, with at least an icon to indicate that they are already used as subgraphs.
- Filters and other options may be added.
- Any ComfyUI workflow can be used as a subgraph; the subgraph input and output nodes will be added on first use.

### Incompatible data types (e.g. COMBO)

When connecting links to `ionodes`, existing connections on the other side may block the new connection from being made. Example:

- Inside a subgraph, a single input is connected to a node FLOAT input with a min/max range of 0.0 - 1.0
- Out in the main workflow, a new link is connected from a FLOAT output that has a valid range of 50.0 - 100.0
- The connection is blocked as the linked types mismatch
- A special UI indication should be implemented
- When implementing, this should be designed so that an option could later be added to allow a keyboard modifier or other method to override this behaviour, and simply disconnect the incompatible links.

### Legacy compatibility

This is a significant change, but should provide compatibility with existing systems where practical.

1. Allow export in compatibility mode - use old format, with subgraphs placed directly in the workflow inside a group.
2. Old APIs
   - Present a virtual graph by recursively flattening the actual graph
   - Allow extensions to interact normally with litegraph via virtual graph `Proxy`(?), or getter/setters for e.g.
     - `LGraph.nodes`
     - `LGraph.groups`
     - etc
3. New APIs
   - Present subgraph-aware nested graphs

### Schema updates

A workflow will include a single copy of every subgraph it contains. Multiple subgraphs can then be added to a workflow, each only adding a few fields of metadata.

1. **Workflow ID**
   1. All workflows will have a UUID assigned during creation, or on load if undefined
   2. An instance of a subgraph is referenced by ID within the workflow itself. This ensures the workflow remains a self-contained unit, and cannot be broken by forgetting to copy supporting files.
   3. The unique ID allows comparison of subgraphs to other revisions (e.g. in other workflows or the local workflow library).
   4. There is no automatic update other workflows, but the design allows a user-controlled mechanism to update workflows with older revisions, without the current requirement to replay all changes by hand. No special handling of destructive changes (e.g. remove subgraph input) is currently planned.
2. **Workflow revision**
   1. Allow copy/paste of any revision as-is, e.g.:
      1. Open a workflow with an old revision of a subgraph in the workflow library.
      2. Copy the subgraph from inside the workflow
      3. Paste the subgraph - old revision is pasted, no update to workflow definitions
   2. Add from toolbox / search always uses library revision
   3. Do not allow multiple revisions in a single workflow (unnecessary complexity - solution for this is to clone the subgraph, giving it a new ID with no connection to the old ID)
3. **Nesting**
   1. Recursive, one-to-many / top-down nesting of graphs
4. **Subgraph inputs & outputs** (`ionodes`)
   - Which widgets are exposed as input/output

### Schema requirements

Proposed extensions to the existing workflow schema (all workflows)

```ts
// Proposed extensions to workflow schema
interface WorkflowExtensions extends SerialisableGraph {
  /** Generated once, never mutated. Default: Generated UUID v4 */
  readonly id: UUIDv4
  /** Automatically incremented on save, if changed. Default: 0 */
  revision: int

  subgraphs?: SubgraphInstance[]

  /** Defines objects referenced elsewhere in the schema */
  definitions?: {
    /** Definitions of all subgraphs used in this workflow. */
    subgraphs?: Record<UUIDv4, SubgraphDefinition>[]
  }
}
```

### An instance of a subgraph, when placed on a (sub)graph

```ts
interface SubgraphInstance {
  id: NodeId
  subgraphId: UUIDv4
  bounding: Rect
  name?: string
  color?: string
  background?: string
  // ... any other display properties, similar to node properties
}
```

### Subgraph definition

```ts
/**
 * Defines a subgraph and its contents.
 * Can be referenced multiple times in a schema.
 */
interface SubgraphDefinition extends WorkflowExtensions {
  /** An input of the subgraph itself. Similar to a reroute, it exists in both the graph and subgraph. */
  inputs: SubgraphIO[]
  /** An output of the subgraph itself. Similar to a reroute, it exists in both the graph and subgraph. */
  outputs: SubgraphIO[]
  /**
   * A list of node widgets displayed in the parent graph, on the subgraph object.
   */
  widgets: ExposedWidget[]
}

/** Subgraph I/O slots */
interface SubgraphIO {
  id: string
  type: string
  // ... other display properties, similar to node inputs and outputs
}

/** A reference to a node widget shown in the parent graph */
interface ExposedWidget {
  id: NodeId
  name: string
}
```

NB: Can be easily adapted to match current pending RFC 02 and/or RFC 04 specifications. RFC 04 in particular would drastically simplify some implementation details and provide unified UX. Caveat is that it would prevent 

### Examples

Workflow example

```jsonc
{
  "id": "10000000-0000-0000-0000-000000000000",
  "revision": 86,
  // Object definitions - define once, use many instances
  "definitions": {
    "subgraphs": {
      // Subgraph workflow (definition)
      "20000000-0000-0000-0000-000000000000": {
        "revision": 3,
        "inputs": [{ "id": 0, "type": "IMAGE" }],
        "outputs": [
          { "id": 0, "type": "IMAGE" },
          { "id": 1, "type": "IMAGE" }
        ],
        "last_node_id": 1,
        "last_link_id": 0,
        "nodes": [
          {
            "id": 1,
            "type": "Invert Image",
            "pos": [410, 380],
            "size": [210, 46],
            "inputs": [{ "name": "image", "type": "IMAGE", "link": 3 }],
            "outputs": [
              { "name": "inverted", "type": "IMAGE", "links": [4] },
              { "name": "sharpened", "type": "IMAGE", "links": [5] }
            ]
            // ... truncated example node
          }
        ],
        "links": [
          [3, "inputs", 0, 1, 0, "IMAGE"],
          [4, 1, 0, "outputs", 0, "IMAGE"],
          [5, 1, 1, "outputs", 1, "IMAGE"]
        ],
        "groups": [],
        "config": {},
        "extra": { "ds": { "scale": 1, "offset": [0, 0] } },
        "version": 2
      }
    }
  },
  "subgraphs": [
    // An instance of a subgraph
    {
      "id": "0",
      "subgraphId": "20000000-0000-0000-0000-000000000000",
      "bounding": [100, 100, 160, 120]
    }
    // [...more subgraph instances]
  ],
  // The rest of the main workflow
  "last_node_id": 1,
  "last_link_id": 0,
  "nodes": [
    {
      "id": 1,
      "type": "VAEDecode",
      "pos": [410, 380],
      "size": [210, 46]
      // ... truncated example node
    }
  ],
  "links": [],
  "groups": [],
  "config": {},
  "extra": { "ds": { "scale": 1, "offset": [0, 0] } },
  "version": 2
}
```

### Definitions

Any mention of UUID refers to v4 UUIDs.

### Future considerations

Implementation should not block desirable future features:

- **Execute subgraph**: Execute a subgraph (e.g. a subgraph with no _required_ inputs).
- **Re-execute**: Execute only the nodes within the subgraph, to edit / fine-tune any changes inside, using forced-cached inputs, and halting execution at the subgraph boundary.

## Drawbacks

1. **Breaking change**
   1. Workflows using linked subgraphs will not function correctly in older versions of ComfyUI.
   2. It is possible to export to an old format, or create a tool to convert workflows to the original format.
2. **Update complexity**
   1. The revision of a subgraph in a users’ library may not match the subgraph revision in a workflow.
   2. Users can update to the latest revision, however this may break connections or cause other issues, similar to “Recreate node” (see Unresolved questions)
   3. No accounting for branching of revisions
3. **Extension compatibility**
   1. Using a `Proxy` to provide a compatibility layer may impact some extensions
   2. Non-proxy alternatives require greater effort
4. **Code complexity**
   1. This is a complex change and cannot simply be brought in with a single PR
   2. Hours required to implement and test

## Alternatives

1. **Group node**: Group nodes were the original solution to provide a subset of functionality. Attempting to re-engineer group nodes to provide the complete set of features is impractical.
2. https://github.com/vivax3794/ComfyUI-Sub-Nodes: A third party extension with a decent feature coverage
   1. Limitations on workflow format
   2. Implements many features via custom nodes - the right approach for an extension, but cannot be easily converted to become new features in core libraries
3. **Subgraph widget**: Representing a subgraph inside a node as a widget. Provides a small UX improvement over the status quo, but with a disproportionately high effort requirement.
4. **Do nothing**: User frustration, soft-limits on workflows, inefficient, messy, impractical.

## Adoption strategy

- [ ] TODO: Requires finalisation of unresolved questions.

If we implement this proposal, how will existing ComfyUI users and developers adopt it? Fastly.

1. **Convert group nodes to subgraphs**: This is planned, but outside the scope of this RFC.
2. **Extensions**: Consider old & new
   1. Updates
   2. New APIs
3. **Schema concerns**: Schema concerns will mirror workflow v2.0 schema RFC and any discussion that even partially includes that RFC should happen there.

## Unresolved questions

1. Is there a reason not to add id & revision to base workflows?
2. Is there any practical, common need for revision schema migrations?
   1. If so, is it a need that must be in core?
3. How badly will my plan to flatten subgraphs→prompt break extensions?
4. When connecting from the input `ionode` to multiple widgets, which widget is represented on the subgraph in the main workflow?
   1. An input is a 1-to-1 match with a data type
   2. There can be multiple widgets that represent a data type (e.g. slider, number)
   3. Simply restrict to exact matches?
