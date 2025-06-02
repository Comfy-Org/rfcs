# RFC: Custom Nodes Dependencies Management

- Start Date: 2025-05-18
- Target Major Version: TBD

## Summary

This RFC proposes a standardized mechanism for ComfyUI custom nodes to declare their dependencies on specific versions of ComfyUI core components. The solution introduces a `ComfyDependencies` field in the custom nodes' `pyproject.toml` file, allowing node developers to specify version requirements for components like Frontend, Core, etc. When version incompatibilities are detected, the system will warn users without blocking installation, helping to prevent unexpected behavior while maintaining flexibility.

## Motivation

Currently, ComfyUI custom nodes have no standardized way to declare which versions of core components they depend on. This leads to several issues:

1. Breaking changes in core components (especially Frontend) can silently break custom nodes functionality.
2. Users experience unexpected behavior with no clear indication of the cause.
3. Node developers lack a mechanism to communicate compatibility requirements.
4. Troubleshooting becomes more difficult without version dependency information.

By implementing a formal dependency specification system, we can:
- Provide clear compatibility information to users
- Help developers communicate requirements
- Reduce support requests related to version incompatibilities
- Improve the overall stability of the ComfyUI ecosystem

## Detailed design

### Dependency Specification Format

Custom nodes will specify their dependencies in the `pyproject.toml` file using a new `ComfyDependencies` array under the `[tool.comfy]` section:

```toml
[tool.comfy]
PublisherId = "example_publisher"
DisplayName = "Example Custom Node"
ComfyDependencies = [
    "frontend >= 1.18.0, < 1.20.0",
    "core >= 1.5.0"
]
```

The dependency format will follow Python's package versioning syntax, supporting operators like:

1. ==: Exact version match
2. \>=, >: Greater than or equal to, greater than
3. <=, <: Less than or equal to, less than
4. ~=: Compatible release clause
5. ,: Combining multiple constraints (AND logic)

refer to [pip requirement specifiers](https://pip.pypa.io/en/stable/reference/requirement-specifiers/#requirement-specifiers)

### Core Component Versioning

For this system to work, ComfyUI core components need clear versioning. We propose:

1. Core components (Frontend, Core, etc.) should each have their own version number
2. Each release with breaking changes must include detailed information about those changes in the release notes.
3. A separate, dedicated document should be maintained to track all breaking changes across versions. This "Breaking Changes Log" should include for each entry:
   - **Date**: When the breaking change was introduced
   - **Pull Request**: Reference to the PR that implemented the change
   - **What Changed**: Detailed description of the change
   - **Reason**: Explanation of why the breaking change was necessary
   - **How to Fix**: Guidance for custom node developers on updating their code

This documentation approach ensures that custom node developers can easily understand what changed between versions and how to adapt their code accordingly, while the dependency specification system provides a way to communicate these requirements to users.

### Implementation Details

1. Dependency Check System:
   - When installing custom nodes (either via Manager/Register or manual installation), the system will parse the ComfyDependencies field.
   - It will compare specified requirements against the currently installed core component versions.
2. Warning Mechanism:
   - If incompatibilities are detected, warnings will be displayed in:
      - Terminal console output
   - A warning in the UI
3. Non-blocking Behavior:
   - Installation will proceed regardless of version incompatibilities.
   - This allows users to still experiment with nodes that might work despite version differences.
4. UI Integration:
   - The ComfyUI Manager/Register will display compatibility information when browsing custom nodes.
   - A warning icon will appear next to potentially incompatible nodes.

### Example Warning Messages
1. Terminal/Log:
```
WARNING: Custom node "Example Node" specifies dependency "frontend >= 1.18.0, < 1.20.0", but your installed version is 1.20.5. 
This may cause unexpected behavior or errors. Consider updating the custom node or downgrading ComfyUI Frontend.
```
2. UI Notification:
```
Version incompatibility detected for "Example Node". This node may not function correctly with your current ComfyUI runtime.
```

### Drawbacks

1. Maintenance Overhead: Core components will need careful versioning and changelog management.
2. False Alarms: Some nodes might work despite version mismatches, potentially causing unnecessary user concerns.
3. Adoption Time: It will take time for the custom node ecosystem to adopt this specification.

## Unresolved questions

1. Should we implement a mechanism to help users find compatible versions of nodes?
2. Should we provide tools to help node developers determine the minimum required versions for their nodes?
3. Should custom nodes be allowed to specify other custom nodes as dependencies(e.g., `CustomNodeDependencies=['ComfyUI-3D-Pack >= 3.2.2']`)?
4. Should we add platform specification capabilities (e.g., `SupportOS=[Windows, Mac]`) to allow custom nodes to indicate which operating systems they support?
5. Should we provide strict mode to block installation of incompatible nodes?