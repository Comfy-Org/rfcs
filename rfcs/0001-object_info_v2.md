# RFC: ComfyUI API Improvements

- Start Date: 2025-02-03
- Target Major Version: TBD

## Summary

This RFC proposes three key improvements to the ComfyUI API:

1. Lazy loading for COMBO input options to reduce initial payload size
2. Restructuring node output specifications for better maintainability
3. Explicit COMBO type definition for clearer client-side handling

## Basic example

### 1\. Lazy Loading COMBO Options

```python
# Before
class CheckpointLoader:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "config_name": (folder_paths.get_filename_list("configs"),),
            }
        }

# After
class CheckpointLoader:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "config_name": ("COMBO", {
                    "type" : "remote",
                    "route": "/internal/files",
                    "response_key" : "files",
                    "query_params" : {
                        "folder_path" : "configs"
                    }
                }),
            }
        }
```

### 2\. Improved Output Specification

```python
# Before
RETURN_TYPES = ("CONDITIONING","CONDITIONING")
RETURN_NAMES = ("positive", "negative")
OUTPUT_IS_LIST = (False, False)
OUTPUT_TOOLTIPS = ("positive-tooltip", "negative-tooltip")

# After
RETURNS = (
    {"type": "CONDITIONING", "name": "positive", "is_list": False, "tooltip": "positive-tooltip"},
    {"type": "CONDITIONING", "name": "negative", "is_list": False, "tooltip": "negative-tooltip"},
)
```

### 3\. Explicit COMBO Type

```python
# Before
"combo input": [[1, 2, 3], { default: 2 }]

# After
"combo input": ["COMBO", { options: [1, 2, 3], default: 2}]
```

## Motivation

1. **Full recompute**: If the user wants to refresh the COMBO options for a single folder, they need to recompute the entire node definitions. This is a very slow process and not user friendly.

2. **Large Payload Issue**: The `/object_info` API currently returns several MB of JSON data, primarily due to eager loading of COMBO options. This impacts initial load times and overall performance.

3. **Output Specification Maintenance**: The current format for defining node outputs requires modifications in multiple lists, making it error-prone and difficult to maintain. Adding new features like tooltips would further complicate this.

4. **Implicit COMBO Type**: The current implementation requires client-side code to infer COMBO types by checking if the first parameter is a list, which is not intuitive and could lead to maintenance issues.

## Detailed design

The implementation will be split into two phases to minimize disruption:

### Phase 1: Combo Specification Changes

#### 1.1 New Combo Specification

Input types will be explicitly defined using tuples with configuration objects. A variant of the `COMBO` type will be added to support lazy loading options from the server.

```python
@classmethod
def INPUT_TYPES(s):
    return {
        "required": {
            # Remote combo
            "ckpt_name": ("COMBO", {
                "type": "remote",
                "route": "/internal/files",
                "response_key": "files",
                "refresh": 0,  # TTL in ms. 0 = do not refresh after initial load.
                "cache_key": None,  # Optional custom cache key
                "invalidation_signal": None,  # Optional websocket event to trigger refresh
                "query_params": {
                    "folder_path": "checkpoints",
                    "filter_ext": [".ckpt", ".safetensors"]
                }
            }),
            "mode": ("COMBO", {
                "options": ["balanced", "speed", "quality"],
                "default": "balanced",
                "tooltip": "Processing mode"
            })
        }
    }
```

#### 1.2 New Endpoints

```python
@routes.get("/internal/files/{folder_name}")
async def list_folder_files(request):
    folder_name = request.match_info["folder_name"]
    filter_ext = request.query.get("filter_ext", "").split(",")
    filter_content_type = request.query.get("filter_content_type", "").split(",")

    files = folder_paths.get_filename_list(folder_name)
    if filter_ext and filter_ext[0]:
        files = [f for f in files if any(f.endswith(ext) for ext in filter_ext)]
    if filter_content_type and filter_content_type[0]:
        files = folder_paths.filter_files_content_type(files, filter_content_type)

    return web.json_response({
        "files": files,
    })
```

#### 1.3 Gradual Change with Nodes

Nodes will be updated incrementally to use the new combo specification.

### Phase 2: Node Output Specification Changes

#### 2.1 New Output Format

Nodes will transition from multiple return definitions to a single `RETURNS` tuple:

```python
# Current format will be supported during transition
RETURN_TYPES = ("CONDITIONING", "CONDITIONING")
RETURN_NAMES = ("positive", "negative")
OUTPUT_IS_LIST = (False, False)
OUTPUT_TOOLTIPS = ("positive-tooltip", "negative-tooltip")

# New format
RETURNS = (
    {
        "type": "CONDITIONING",
        "name": "positive",
        "is_list": False,
        "tooltip": "positive-tooltip",
        "optional": False  # New field for optional outputs
    },
    {
        "type": "CONDITIONING",
        "name": "negative",
        "is_list": False,
        "tooltip": "negative-tooltip"
    }
)
```

#### 2.2 New Response Format

Old format:

```javascript
{
    "CheckpointLoader": {
        "input": {
            "required": {
                "ckpt_name": [[
                    "file1",
                    "file2",
                    ...
                    "fileN",
                ]],
                "combo_input": [[
                    "option1",
                    "option2",
                    ...
                    "optionN",
                ], {
                    "default": "option1",
                    "tooltip": "Processing mode"
                }],
            },
            "optional": {}
        },
        "output": ["MODEL"],
        "output_name": ["model"],
        "output_is_list": [false],
        "output_tooltip": ["The loaded model"],
        "output_node": false,
        "category": "loaders"
    }
}
```

New format:

```javascript
{
    "CheckpointLoader": {
        "input": {
            "required": {
                "ckpt_name": [
                    "COMBO",
                    {
                        "type" : "remote",
                        "route": "/internal/files",
                        "response_key" : "files",
                        "query_params" : {
                            "folder_path" : "checkpoints"
                        }
                    }
                ],
                "combo_input": [
                    "COMBO",
                    {
                        "options": ["option1", "option2", ... "optionN"],
                        "default": "option1",
                        "tooltip": "Processing mode"
                    }
                ],
            },
            "optional": {}
        },
        "output": [
            {
                "type": "MODEL",
                "name": "model",
                "is_list": false,
                "tooltip": "The loaded model"
            }
        ],
        "output_node": false,
        "category": "loaders"
    }
}
```

#### 2.3 Compatibility Layer

Transformations will be applied on the frontend to convert the old format to the new format.

#### 2.4 Gradual Change with Nodes

Nodes will be updated incrementally to use the new output specification format.

### Migration Support

To support gradual migration, the API will:

1. **Dual Support**: Accept both old and new node definitions
2. **Compatibility Layer**: Include a compatibility layer in the frontend that can type check and handle both old and new formats.

## Drawbacks

1. **Migration Effort**: Users and node developers will need to update their code to match the new formats.
2. **Additional Complexity**: Lazy loading adds network requests, which could complicate error handling and state management.

## Adoption strategy

1. **Version Support**: Maintain backward compatibility for at least one major version.
2. **Migration Guide**: Provide detailed documentation and migration scripts.
3. **Gradual Rollout**: Implement changes in phases, starting with lazy loading.

## Unresolved questions

1. ~~How should we handle network failures in lazy loading scenarios?~~ Backoff and retry logic will be implemented.
2. Should we provide a migration utility for updating existing nodes?

3. A: Provide clear migration instructions should be enough.

4. How do we handle custom node types that may not fit the new output specification format?

5. ~~What is the optimal caching strategy for lazy-loaded COMBO options?~~ Caching strategy determined per-widget. By default, initialize on first access and do not re-fetch.
