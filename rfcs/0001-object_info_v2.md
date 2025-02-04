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

Use a Proxy on remote combo widgets' values property that doesn't compute/fetch until first access.

```typescript
  COMBO(node, inputName, inputData: InputSpec, app, widgetName) {

  // ...

  const res = {
    widget: node.addWidget('combo', inputName, defaultValue, () => {}, {
      // Support old and new combo input specs
      values: widgetStore.isComboInputV2(inputData)
        ? inputData[1].options
        : inputType
    })
  }

  if (type === 'remote') {
    const remoteWidget = useRemoteWidget(inputData)

    const origOptions = res.widget.options
    res.widget.options = new Proxy(origOptions, {
      // Defer fetching until first access (node added to graph)
      get(target, prop: string | symbol) {
        if (prop !== 'values') return target[prop]

        // Start non-blocking fetch
        remoteWidget.fetchOptions().then((data) => {})

        const current = remoteWidget.getCacheEntry()
        return current?.data || widgetStore.getDefaultValue(inputData)
      }
    })
  }
```

Backoff time will be determined by the number of failed attempts:

```typescript
// Exponential backoff with max of 10 seconds
const backoff = Math.min(1000 * 2 ** (failedAttempts - 1), 10000);

// Example backoff times:
// Attempt 1: 1000ms (1s)
// Attempt 2: 2000ms (2s)
// Attempt 3: 4000ms (4s)
// Attempt 4: 8000ms (8s)
// Attempt 5+: 10000ms (10s)
```

Share computation results between widgets using a key based on the route and query params:

```typescript
// Global cache for memoizing fetches
const dataCache = new Map<string, CacheEntry<any>>();

function getCacheKey(options: RemoteWidgetOptions): string {
  return JSON.stringify({ route: options.route, params: options.query_params });
}
```

The cache can be invalidated in two ways:

1. **TTL-based**: Using the `refresh` parameter to specify a time-to-live in milliseconds. When TTL expires, next access triggers a new fetch.
2. **Manual**: Using the `forceUpdate` method of the widget, which deletes the cache entry and triggers a new fetch on next access.

Example TTL usage:

```python
"ckpt_name": ("COMBO", {
    "type": "remote",
    "refresh": 60000,  # Refresh every minute
    // ... other options
})
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

### Resolved

1. ~~Network failure handling~~ - Implemented with exponential backoff
2. ~~Caching strategy~~ - Per-widget initialization with manual invalidation

### Implementation Details

3. Should we provide a migration utility for updating existing nodes?
4. How do we handle custom node types that may not fit the new output specification format?

### Future Considerations

5. Should an option to set an invalidation signal be added to the remote COMBO type?
6. Should an option for a custom cache key for the remote COMBO type be added?

### Security Concerns

7. Implementation details needed for:
   - Rate limiting strategy
   - Input validation approach
   - Cache poisoning prevention measures
   - Access control mechanisms
