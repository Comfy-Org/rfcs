# RFC: Vue Component Rendering System for Custom Nodes

- Start Date: 2025-05-19
- Target Major Version: 1.x
- Reference Issues: N/A
- Implementation PR: (leave this empty)

## Summary

This RFC proposes a standardized public API for custom nodes to render Vue components in the ComfyUI frontend. The system will enable consistent, extensible UI rendering through well-defined interfaces that work seamlessly across distributed environments.

## Basic example

### Backend (Node Implementation)

```python
from comfy.ui_components import render_component

class CustomViewNode(ComfyNodeABC):
    """Example node that renders a custom Vue component in the UI."""
    
    def __init__(self):
        self.session_id = str(uuid.uuid4())
        self.history = []
        
    @classmethod
    def INPUT_TYPES(cls) -> InputTypeDict:
        return {
            "required": {
                "prompt": (IO.STRING, {"multiline": True}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID"  # Node ID is passed via execution
            }
        }

    RETURN_TYPES = (IO.STRING,)
    FUNCTION = "process"
    CATEGORY = "example"
    
    def process(self, prompt, unique_id=None):
        # Process the prompt
        result = f"Processed: {prompt}"
        
        # Add to history
        self.history.append({
            "prompt": prompt,
            "response": result,
            "timestamp": time.time()
        })
        
        # Render the component with history data
        render_component(
            node_id=unique_id,
            component="ChatHistoryWidget",
            props={
                "history": json.dumps(self.history),
                "key": "chat_history"  # Use Vue's built-in key property for component identification
            }
        )
        
        return (result,)
```

### Python Client API

```python
# comfy/ui_components.py

def render_component(node_id, component, props=None):
    """Render a Vue component on a specific node.
    
    Args:
        node_id: The ID of the node to render the component on
        component: The name of the component to render
        props: Optional properties to pass to the component
    """
    message = {
        "node_id": node_id,
        "component": component,
        "props": props or {}
    }
    from server import PromptServer
    PromptServer.instance.send_sync("render_component", message)

def update_component_props(node_id, component, props):
    """Update the props of an existing component.
    
    Args:
        node_id: The ID of the node with the component
        component: The name of the component to update
        props: The new props to set
    """
    message = {
        "node_id": node_id,
        "component": component,
        "props": props
    }
    from server import PromptServer
    PromptServer.instance.send_sync("update_component_props", message)
```

## Motivation

The current approaches to custom UI elements in ComfyUI nodes have several limitations:

1. **Ad-hoc Implementations**: Most developers either use direct DOM manipulation or rely on injecting raw JavaScript, making it difficult to maintain consistency and functionality across the ecosystem.

2. **Distributed Computing Constraints**: As ComfyUI evolves toward cloud-distributed architecture where nodes may run in separate processes or containers, a stable public API is needed for UI interactions.

3. **Technical Barrier**: Most custom node developers don't know JavaScript well enough to create complex UI elements, leading to poor user interfaces or avoidance of interactive features altogether.

4. **Maintenance Challenges**: Without a standardized API, the frontend team must support various approaches to UI rendering, increasing technical debt and making it harder to evolve the platform.

A standardized Vue component rendering system would provide:

1. **Clean Public API**: A well-defined interface that can have its implementation changed to work with future process-per-node and cloud systems, without breaking custom nodes.

2. **Simplified Development**: Node developers can focus on Python functionality rather than requiring JavaScript expertise.

3. **Consistent User Experience**: A standard component library ensures custom nodes can be distinctive while maintaining a consistent look and feel within the overall application.

4. **Better Extensibility**: UI capabilities can be expanded centrally without requiring changes to individual nodes.

5. **Future-Proof Architecture**: The design accommodates both local and distributed environments through a stable public interface.

## Detailed design

The Vue component rendering system includes several key components:

### 1. Backend Public API

The core of the system is a clean, stable public API for Python nodes:

```python
# comfy/ui_components.py

from server import PromptServer

def render_component(node_id, component, props=None):
    """Render a Vue component on a specific node."""
    message = {
        "node_id": node_id,
        "component": component,
        "props": props or {}
    }
    PromptServer.instance.send_sync("render_component", message)
    
def update_component_props(node_id, component, props):
    """Update props of a rendered component."""
    message = {
        "node_id": node_id,
        "component": component, 
        "props": props
    }
    PromptServer.instance.send_sync("update_component_props", message)
```

The public API will remain stable across versions, while the internal implementation can change to support different deployment models (e.g., local vs. cloud, single-process vs. multi-process).

### 2. Component Library

ComfyUI will provide a standard component library that node developers can use:

1. **Text Components**:
   - `MarkdownDisplay` - Renders markdown content
   - `CodeDisplay` - Displays code with syntax highlighting
   - `TextPreview` - Shows text with formatting options

2. **Chat Components**:
   - `ChatHistory` - Displays a conversation history
   - `MessageBubble` - Individual chat message rendering

3. **Media Components**:
   - `ImageSelector` - Displays multiple images with a selector
   - `AudioPlayer` - Audio playback with controls
   - `VideoPlayer` - Video playback with controls
   - `ImageComparisonSlider` - Compare before/after images
   - `AudioWaveformEditor` - Edit audio waveforms

4. **Form Components**:
   - Standard form controls following PrimeVue component patterns
   - (See https://primevue.org/ for complete list of available components)

The component library will be maintained centrally, ensuring consistency across the application.

### 3. Component State Management

There are two primary ways to manage component state:

1. **Return Dict Method**: Nodes can include UI specifications in their return value:

```python
def process(self, input_data, unique_id=None):
    result = process_data(input_data)
    
    # Include UI specification in return dict
    return {
        "ui": {
            "component": "ChatHistoryWidget",
            "props": {
                "history": self.get_history_text(),
                "key": "chat_history"
            }
        },
        "results": result
    }
```

2. **Direct Message Method**: Nodes can send UI update messages at any time:

```python
def on_event(self, event_data, unique_id=None):
    # Update UI in response to an event
    render_component(
        node_id=unique_id,
        component="StatusDisplay",
        props={
            "status": "Processing...",
            "key": "status_display"
        }
    )
    
    # Process the event
    result = process_event(event_data)
    
    # Update UI again
    render_component(
        node_id=unique_id,
        component="StatusDisplay",
        props={
            "status": "Complete",
            "key": "status_display"
        }
    )
    
    return result
```

## Drawbacks


1. **Performance**: Additional component rendering may impact performance on complex workflows. Using Vue is much less performant than using canvas. Adding support for dynamic component rendering over WebSocket adds overhead compared with defined lifecycle methods and singular events in which components are updated.

2. **Maintenance Burden**: Supporting component rendering requires ongoing maintenance of both backend APIs and frontend components.

## Alternatives

1. **Jinja/Template-Based Approach**: Use a server-side templating system like Jinja to generate HTML for custom UIs. While simpler, this would be less interactive.

2. **Gradio-Style Components**: Adopt an approach similar to Gradio, with a high-level component API. This might be easier for beginners but less flexible for advanced UI needs.

## Adoption strategy

The adoption will be implemented in parallel tracks:

### Track 1: Core API and Documentation

1. Implement the `comfy.ui_components` module with the public API
2. Create documentation for the new API with clear examples
3. Add support in the node execution engine to handle UI specifications in return values

### Track 2: Component Development

1. Develop the standard component library
2. Implement the frontend message handlers
3. Create example nodes that demonstrate various component usage patterns

## Unresolved questions

1. **Real-time Updates**: How should components handle real-time updates from backend processes?

2. **Error Handling**: What should happen when a component fails to render or a node tries to render an unregistered component?

3. **Component State**: How should stateful components communicate state changes back to the backend when user interaction occurs?

## Future Considerations

1. **Component Registry and Manifest System**: In the future, we could explore a system that allows custom nodes to register their own Vue components:

```json
{
  "components": [
    {
      "name": "MyCustomWidget",
      "path": "./components/MyCustomWidget.vue",
      "description": "A custom widget for displaying data"
    }
  ]
}
```