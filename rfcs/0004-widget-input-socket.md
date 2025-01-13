# RFC: Widget Input Socket

- Start Date: 2025-01-13
- Target Major Version: TBD
- Reference Issues:

  - <https://github.com/Comfy-Org/ComfyUI_frontend/pull/1021>

## Summary

This RFC proposes replacing ComfyUI's current widget-to-socket conversion system with a simpler, more intuitive "widget input socket" design. Instead of requiring users to manually convert widgets to sockets through context menus, widgets will automatically display an input socket when hovered over. This socket behaves like any other input socket - allowing users to drag connections to and from it. When connected, the widget becomes disabled (grayed out) to indicate it's receiving an external input.

This change aims to:

- Simplify the codebase by removing complex conversion logic
- Improve usability by making connections more discoverable and intuitive
- Align with industry standards seen in tools like Blender
- Reduce the number of clicks needed to make connections
- Eliminate the need to maintain conversion states in workflow files

The proposal represents a breaking change that would be implemented in v2.0, though existing workflows would continue to function without modification.

## Basic example

### Current conversion mechanism between widget and socket

#### Convert from widget to socket

To convert a widget to a socket, the user needs to first right click the node, and then select the corresponding conversion option from the context menu.

![conversion_context_menu](https://github.com/user-attachments/assets/522f163b-8aad-42b2-a899-817c1a0bae75)

![converted_socket](https://github.com/user-attachments/assets/ab6c50a3-ee33-443c-89ca-73d3a3c67042)

#### Convert from socket to widget

There are two ways to convert a socket to a widget:

1\. **Option1**: Right click the node, and select the corresponding conversion option from the context menu.

![conversion_context_menu](https://github.com/user-attachments/assets/4e47f740-d607-44da-b49c-4a9bea548656)

2\. **Option2**: Drag a link of correct type from an output socket on another node to the widget (Implemented in <https://github.com/Comfy-Org/ComfyUI_frontend/pull/1021>).

![drag_link_to_widget](https://github.com/user-attachments/assets/360013b2-d350-4fb0-bbce-cb860178d9ed)

### Proposed design for widget input socket

When the cursor hovers over a widget, a socket will be shown on the left side of the widget. The socket will be interacted the same way as the current input socket, i.e.

- user can drag a link from the socket and drop to another node's output socket to create a new link
- user can drag a link from another node's output socket and drop to the socket to create a new link

![cursor_hover_on_widget](https://github.com/user-attachments/assets/953867dc-f27c-47de-a06f-aa94a29350a4)

When connected, the widget will be disabled (grayed out) and the socket will be highlighted.

![connected_widget_socket](https://github.com/user-attachments/assets/fe17d9b2-01c6-441a-adc6-f869f7aa3cbf)

## Motivation

1. **Simplified State Management**

  - Current implementation requires complex state tracking for widget/socket conversion status
  - Eliminates need to persist conversion state in workflow files
  - Removes the `force_input` configuration complexity from node definitions
  - Reduces potential for bugs related to state synchronization

2. **Improved Discoverability**

  - New users often struggle to discover the widget-to-socket conversion feature
  - Hover-based socket visibility provides immediate visual feedback
  - Makes connection capabilities self-evident without requiring documentation
  - Follows established UI patterns where hover reveals additional functionality

3. **Industry Standard Alignment**

  - Matches behavior in popular node-based tools like Blender
  - Reduces learning curve for users coming from other platforms
  - Leverages existing mental models from the visual programming community
  - Makes ComfyUI feel more familiar to experienced node-based workflow users

4. **Cognitive Simplification**

  - Eliminates the artificial distinction between widgets and sockets
  - Treats all inputs as potentially connectable by default
  - Removes need to teach users about "conversion" as a concept
  - Provides a more intuitive "what you see is what you can do" interface

5. **Workflow Optimization**

  - Reduces actions needed to create connections from 3+ clicks to 1 drag
  - Eliminates context menu navigation time
  - Speeds up workflow creation and modification
  - Particularly beneficial for complex workflows with many connections

6. **Enhanced Accessibility**

  - Reduces fine motor control requirements compared to context menu usage
  - Provides larger hit areas for connection interactions
  - More forgiving of slight cursor movement during interaction
  - Supports users with various input devices more effectively

7. **Technical Benefits**

  - Simplifies the codebase by removing conversion logic
  - Makes widget behavior more predictable and easier to test
  - Reduces potential edge cases in the connection system
  - Easier to maintain and extend in the future

The primary goal is to make ComfyUI more intuitive and efficient to use while reducing implementation complexity. This change would bring the interface more in line with user expectations and industry standards, while simultaneously simplifying the codebase.

## Detailed design

### Component Updates

#### LGraphCanvas

1. **Widget Socket Rendering**

  - Modify `drawNodeWidgets()` to render an input socket for a widget when:

    - The widget is being hovered
    - The socket has an active connection
    - A compatible link is being dragged

  - Update `drawNode()` to skip rendering duplicate sockets for widget inputs

2. **Interaction Handling**

  - Extend `isOverNodeInput()` to detect cursor position over widget input sockets
  - Return `true` when cursor is within the socket's hit area

#### LGraphWidget

1. **Disabled State Management**

  - Add `isDisabled` getter property

    - Returns `true` when the widget has a connected input socket

  - Used to control widget interactivity and visual state

2. **Visual Styling**

  - Apply 0.5 opacity to widgets in disabled state
  - Maintain visual consistency with standard disabled UI elements

### Data Structure Changes

#### LGraphNode

1. **Input Management**

  - Extend `inputs` array to include widget input sockets
  - Add widget reference to each input socket object:

    ```typescript
    interface InputSocket {
    widget?: LGraphWidget;
    // ... existing input socket properties
    }
    ```

2. **Serialization**

  - Maintain compatibility with existing serialization format

    - Reference: [RFC #2](https://github.com/Comfy-Org/rfcs/pull/2)

  - No changes required to current workflow file structure

## Drawbacks

1. **Implementation Challenges**

  - Need to modify core rendering logic in LGraphCanvas
  - Potential edge cases with complex layouts for custom DOM widgets
  - Additional complexity in handling hover states during link dragging
  - Need to maintain backward compatibility with existing workflows

2. **User Experience Trade-offs**

  - Loss of explicit user control over widget/socket conversion
  - Hover-based interactions may be less reliable on touch devices
  - May be less discoverable than context menu options for some users

3. **Migration Concerns**

  - Existing tutorials and documentation will need updates
  - Users familiar with the current system will need to adapt
  - Custom nodes using the current widget conversion system may need modifications

## Adoption strategy

The transition to the new widget input socket design will be implemented in a single phase:

### Implementation Phase (v2.0)

1. **Breaking Changes**

  - Replace the existing conversion system with the new widget input socket design
  - Remove all conversion-related APIs and context menu options
  - Remove `force_input` configurations from node definitions
  - Clean up legacy conversion code from the codebase

2. **Documentation & Communication**

  - Update official documentation with the new interaction model
  - Provide migration guides for node developers
  - Create visual tutorials demonstrating the new connection workflow
  - Issue clear communication about the breaking changes

3. **Ecosystem Impact**

  - Custom node developers will need to:

    - Remove any conversion-specific code
    - Update widget definitions to work with new socket system
    - Test existing nodes with the new connection behavior

4. **User Impact**

  - All existing workflows will continue to work as expected
  - Users will immediately benefit from the simplified interaction model
  - No manual migration steps required for end users

This direct approach allows us to quickly realize the benefits of the new design while minimizing the complexity of maintaining two parallel systems. Since the new design is more intuitive and requires less user education, the transition cost is justified by the immediate improvements in usability.

## Unresolved questions
