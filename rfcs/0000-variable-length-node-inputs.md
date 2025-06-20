# RFC: Variable Length Node Inputs

- Start Date: 2025-01-17
- Target Major Version: TBD
- Reference Issues:
- Implementation PR:

## Summary

This RFC proposes adding support for variable-length inputs in ComfyUI nodes, allowing a single node to accept a dynamic number of inputs. The feature introduces a new `var_length` input type configuration that enables nodes to handle multiple inputs through either socket connections or widget inputs, with configurable minimum and maximum input counts. This eliminates the need for multiple fixed-input node variants or chained node connections, resulting in cleaner workflows and more maintainable code.

## Basic example

There are currently two ways to handle combining variable length of inputs.

### Current Method 1: define a node for each possible length

Following code is an example of how to define a node for each possible length of inputs. The code defines

- `CombineHooks2` node for 2 inputs
- `CombineHooks4` node for 4 inputs
- `CombineHooks8` node for 8 inputs

<https://github.com/comfyanonymous/ComfyUI/blob/619b8cde74538a1dc62b85e47e34daa493705c06/comfy_extras/nodes_hooks.py#L617-L711>

```python
###########################################
# Combine Hooks
#------------------------------------------
class CombineHooks:
    NodeId = 'CombineHooks2'
    NodeName = 'Combine Hooks [2]'
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
            },
            "optional": {
                "hooks_A": ("HOOKS",),
                "hooks_B": ("HOOKS",),
            }
        }

    EXPERIMENTAL = True
    RETURN_TYPES = ("HOOKS",)
    CATEGORY = "advanced/hooks/combine"
    FUNCTION = "combine_hooks"

    def combine_hooks(self,
                      hooks_A: comfy.hooks.HookGroup=None,
                      hooks_B: comfy.hooks.HookGroup=None):
        candidates = [hooks_A, hooks_B]
        return (comfy.hooks.HookGroup.combine_all_hooks(candidates),)

class CombineHooksFour:
    NodeId = 'CombineHooks4'
    NodeName = 'Combine Hooks [4]'
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
            },
            "optional": {
                "hooks_A": ("HOOKS",),
                "hooks_B": ("HOOKS",),
                "hooks_C": ("HOOKS",),
                "hooks_D": ("HOOKS",),
            }
        }

    EXPERIMENTAL = True
    RETURN_TYPES = ("HOOKS",)
    CATEGORY = "advanced/hooks/combine"
    FUNCTION = "combine_hooks"

    def combine_hooks(self,
                      hooks_A: comfy.hooks.HookGroup=None,
                      hooks_B: comfy.hooks.HookGroup=None,
                      hooks_C: comfy.hooks.HookGroup=None,
                      hooks_D: comfy.hooks.HookGroup=None):
        candidates = [hooks_A, hooks_B, hooks_C, hooks_D]
        return (comfy.hooks.HookGroup.combine_all_hooks(candidates),)

class CombineHooksEight:
    NodeId = 'CombineHooks8'
    NodeName = 'Combine Hooks [8]'
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
            },
            "optional": {
                "hooks_A": ("HOOKS",),
                "hooks_B": ("HOOKS",),
                "hooks_C": ("HOOKS",),
                "hooks_D": ("HOOKS",),
                "hooks_E": ("HOOKS",),
                "hooks_F": ("HOOKS",),
                "hooks_G": ("HOOKS",),
                "hooks_H": ("HOOKS",),
            }
        }

    EXPERIMENTAL = True
    RETURN_TYPES = ("HOOKS",)
    CATEGORY = "advanced/hooks/combine"
    FUNCTION = "combine_hooks"

    def combine_hooks(self,
                      hooks_A: comfy.hooks.HookGroup=None,
                      hooks_B: comfy.hooks.HookGroup=None,
                      hooks_C: comfy.hooks.HookGroup=None,
                      hooks_D: comfy.hooks.HookGroup=None,
                      hooks_E: comfy.hooks.HookGroup=None,
                      hooks_F: comfy.hooks.HookGroup=None,
                      hooks_G: comfy.hooks.HookGroup=None,
                      hooks_H: comfy.hooks.HookGroup=None):
        candidates = [hooks_A, hooks_B, hooks_C, hooks_D, hooks_E, hooks_F, hooks_G, hooks_H]
        return (comfy.hooks.HookGroup.combine_all_hooks(candidates),)
```

### Current Method 2: node chaining

Following example shows how a single `Conditioning (Combine)` node can be used to combine any number of conditions.

![condition-chaining](https://github.com/user-attachments/assets/11aed37e-950c-4bd4-9a17-b1c4999560ac)

```python
class ConditioningCombine:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"conditioning_1": ("CONDITIONING", ), "conditioning_2": ("CONDITIONING", )}}
    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "combine"

    CATEGORY = "conditioning"

    def combine(self, conditioning_1, conditioning_2):
        return (conditioning_1 + conditioning_2, )
```

### Proposed Method: Variable Length Node Inputs

The proposed method is to add a new input type `{"var_length": True, "min_length": 2}` to the `CONDITIONING` input type. This input type will be used to indicate that the node can accept a variable number of inputs, and the minimum number of inputs is 2\. The `combine` function will use Python's `*` operator to accept a variable number of inputs. There can only be one variable length input per node at the last of parameter list.

#### Socket input

```python
class ConditioningCombineN:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"conditionings": ("CONDITIONING", {"var_length": True, "min_length": 2})}}

    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "combine"

    CATEGORY = "conditioning"

    def combine(self, *conditionings):
        return (sum(conditionings), )
```

Initial state of the node will appear the same as the current method 2 with 2 inputs. ![condition-chaining-before](https://github.com/user-attachments/assets/f775fbdd-778a-48db-a13a-4e831836949e)

After both inputs are connected, a new input socket will appear. ![condition-chaining-n](https://github.com/user-attachments/assets/9c7cc7fc-5f91-4dab-a245-a3d292b1a46e)

#### Widget input

```python
class MathSumN:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"ints": ("INT", {"var_length": True, "min_length": 2})}}

    RETURN_TYPES = ("INT",)
    FUNCTION = "sum"

    CATEGORY = "math"

    def sum(self, *ints):
        return (sum(ints), )
```

There will be two buttons on the node to add or remove an input widget.

![math-sum-n-widget](https://github.com/user-attachments/assets/49c84db3-0540-469a-b72d-d121ce90ca13)

## Motivation

The current approaches for handling variable-length inputs in ComfyUI nodes have several limitations:

1. **Method 1 (Multiple Node Definitions):**

  - Requires maintaining multiple nearly-identical node classes
  - Limited to predefined input counts (e.g., 2, 4, 8)
  - Clutters the node selection menu with multiple versions
  - Makes code maintenance more difficult due to duplication

2. **Method 2 (Node Chaining):**

  - Requires creating multiple instances of the same node
  - Results in complex, hard-to-read workflows
  - Increases the chance of user error when connecting many nodes
  - Less efficient in terms of workflow space usage

The proposed variable-length input feature would solve these issues by:

- Allowing a single node to handle any number of inputs dynamically
- Providing a cleaner, more intuitive user interface
- Reducing code duplication and maintenance overhead
- Enabling more compact and readable workflows
- Making it easier for node developers to implement variable input functionality

## Detailed design

The variable-length input feature will be implemented through extensions to the existing ComfyUI node input system. The implementation consists of two main parts: socket inputs and widget inputs.

### Socket Inputs Implementation

#### Input Type Definition

Nodes can specify variable-length inputs by adding the `var_length` property to their input type definition:

```python
@classmethod
def INPUT_TYPES(s):
    return {
        "required": {
            "inputs": ("CONDITIONING", {
                "var_length": True,
                "min_length": 2,  # Optional, defaults to 1
                "max_length": 10  # Optional, defaults to unlimited
            })
        }
    }
```

Key properties:

- `var_length`: Boolean flag indicating this is a variable-length input
- `min_length`: Minimum number of inputs required (must be ≥ 1)
- `max_length`: Optional maximum number of inputs (if omitted, unlimited)

#### Socket Behavior

1. The node initially displays the minimum number of input sockets
2. When all existing sockets are connected, a new socket automatically appears
3. When a connection is removed and the number of connected sockets falls below the minimum, the node enters an invalid state
4. Sockets maintain consistent naming with numerical suffixes (e.g., "input_1", "input_2", etc.)

### Widget Inputs Implementation

#### Input Type Definition

Similar to socket inputs, but typically used for primitive types:

```python
@classmethod
def INPUT_TYPES(s):
    return {
        "required": {
            "values": ("INT", {
                "var_length": True,
                "min_length": 2,
                "min": 0, # Standard widget constraints
                "max": 100, # Standard widget constraints
                "step": 1 # Standard widget constraints
            })
        }
    }
```

Additional properties for widgets:

- Standard widget constraints (`min`, `max`, `step`, etc.) apply to all instances

#### Widget UI Controls

1. The node displays "+" and "-" buttons for adding/removing widgets
2. The "+" button is disabled when reaching `max_length` (if specified)
3. The "-" button is disabled when at `min_length`
4. Each widget maintains independent state but shares constraints

### Common Implementation Details

#### Function Implementation

The node's processing function receives inputs as variable arguments:

```python
def process(self, *inputs):
    # inputs is a tuple containing all values
    result = some_operation(*inputs)
    return (result,)
```

#### API Compatibility

The feature maintains backward compatibility:

- Existing nodes continue to work without modification
- Old workflows using fixed-input nodes remain valid
- The API allows gradual adoption of variable-length inputs

## Drawbacks

This feature is not a breaking change.

## Alternatives

Alternatives already discussed in the basic example section.

## Adoption strategy

The variable-length node inputs feature is designed for smooth adoption by both users and developers:

### For Users

- This is not a breaking change - all existing workflows will continue to function as before
- Users can gradually transition to the new variable-length nodes as they become available
- The familiar interface (similar to existing node chaining) means minimal learning curve
- Existing fixed-input nodes can coexist with new variable-length nodes

### For Node Developers

- Adoption is optional - developers can continue using fixed inputs if preferred
- Migration path is straightforward:

  1. Update INPUT_TYPES to include var_length configuration
  2. Modify the processing function to accept variable arguments
  3. Remove redundant node classes (e.g., separate classes for 2/4/8 inputs)

- Comprehensive documentation and examples will be provided
- Existing node implementations remain valid

### Implementation Timeline

1. Initial release with core support for variable-length inputs
2. Gradual migration of built-in nodes to use the new feature where appropriate
3. Community feedback period to refine the implementation
4. Documentation updates and best practices guides for node developers

## Unresolved questions

Optional, but suggested for first drafts. What parts of the design are still TBD?
