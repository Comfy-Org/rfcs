# RFC: ComfyUI API Improvements

- Start Date: 2025-01-06
- Target Major Version:

  - ComfyUI 0.4
  - ComfyUI_frontend 1.8

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
                "ckpt_name": (folder_paths.get_filename_list("checkpoints"),),
            }
        }

# After
class CheckpointLoader:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "config_name": ("FILE_COMBO", {"folder_path": "configs"}),
                "ckpt_name": ("FILE_COMBO", {"folder_path": "checkpoints"}),
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

### Phase 1: Node Definition Format Changes

#### 1.1 New Output Format

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

#### 1.2 Input Type Definitions

Input types will be explicitly defined using tuples with configuration objects:

```python
@classmethod
def INPUT_TYPES(s):
    return {
        "required": {
            # File-based combos become FILE_COMBO type
            "ckpt_name": ("FILE_COMBO", {
                "folder_path": "checkpoints",
                "filter_ext": [".ckpt", ".safetensors"]
            }),
            # Regular combos become explicit
            "mode": ("COMBO", {
                "options": ["balanced", "speed", "quality"],
                "default": "balanced",
                "tooltip": "Processing mode"
            })
        }
    }
```

### Phase 2: API Changes

#### 2.1 New Endpoints

```python
@routes.get("/api/list_files/{folder_name}")
async def list_folder_files(request):
    folder_name = request.match_info["folder_name"]
    filter_ext = request.query.get("filter_ext", "").split(",")

    files = folder_paths.get_filename_list(folder_name)
    if filter_ext and filter_ext[0]:
        files = [f for f in files if any(f.endswith(ext) for ext in filter_ext)]

    return web.json_response({
        "files": files,
        "folder": folder_name
    })

@routes.get("/api/node_definitions")
async def get_node_definitions(request):
    node_class = request.query.get("node_class")

    response = {}
    if node_class:
        # Single node info
        response[node_class] = node_info_v2(node_class)
    else:
        # All nodes info (default behavior)
        for cls in nodes.NODE_CLASS_MAPPINGS:
            response[cls] = node_info_v2(cls)

    return web.json_response(response)

@routes.get("/api/object_info")
async def get_object_info(request):
    logging.warning("Deprecated: use /api/v2/node_definitions instead")
    return node_info_v1(request)
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
                    "FILE_COMBO",
                    {
                        "folder_path": "checkpoints",
                        "filter_ext": [".ckpt", ".safetensors"]
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

#### 2.3 Caching Strategy

- File listings will be cached server-side with a configurable TTL
- Cache invalidation on file system changes
- Client-side caching headers for file listings

```python
CACHE_TTL = 300  # 5 minutes

class FileListCache:
    def __init__(self):
        self.cache = {}
        self.last_update = {}

    async def get_files(self, folder, filter_ext=None):
        now = time.time()
        if folder in self.cache:
            if now - self.last_update[folder] < CACHE_TTL:
                return self.cache[folder]

        files = folder_paths.get_filename_list(folder)
        self.cache[folder] = files
        self.last_update[folder] = now
        return files
```

### Migration Support

To support gradual migration, the API will:

1. Accept both old and new node definitions
2. Provide both v1 and v2 API endpoints
3. Include a compatibility layer in the frontend

The old endpoints will be deprecated but maintained until the next major version.

## Drawbacks

1. **Migration Effort**: Users and node developers will need to update their code to match the new formats.
2. **Additional Complexity**: Lazy loading adds network requests, which could complicate error handling and state management.

## Adoption strategy

1. **Version Support**: Maintain backward compatibility for at least one major version.
2. **Migration Guide**: Provide detailed documentation and migration scripts.
3. **Gradual Rollout**: Implement changes in phases, starting with lazy loading.

## Unresolved questions

1. How should we handle network failures in lazy loading scenarios?
2. Should we provide a migration utility for updating existing nodes?

  1. A: Provide clear migration instructions should be enough.

3. How do we handle custom node types that may not fit the new output specification format?
4. What is the optimal caching strategy for lazy-loaded COMBO options?
