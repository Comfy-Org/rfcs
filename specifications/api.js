/**
 * The main app instance that you'll use to register tabs and access functionality
 */
export interface AppInstance {
  /** Use this to register new sidebar tabs */
  extensionManager: ExtensionManager;
  /** Access the current workflow graph */
  graph: Graph;
  /** Access the API for events and other functionality */
  api: API;
}

/**
 * Configuration for a sidebar tab - use this with app.extensionManager.registerSidebarTab()
 */
export interface SidebarTabConfig {
  /** Unique identifier for the tab */
  id: string;
  /** Icon class for the tab button (e.g., 'pi pi-compass', 'mdi mdi-robot', 'fa-solid fa-star') */
  icon: string;
  /** Title text for the tab */
  title: string;
  /** Optional tooltip text shown on hover */
  tooltip?: string;
  /** Tab type (usually "custom") */
  type: string;
  /** Function that populates the tab content. Can return a cleanup function. */
  render: (element: HTMLElement) => void | (() => void);
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Basic tab registration
 * app.extensionManager.registerSidebarTab({
 *   id: "customSidebar",
 *   icon: "pi pi-compass",
 *   title: "Custom Tab",
 *   tooltip: "My Custom Sidebar Tab",
 *   type: "custom",
 *   render: (el) => {
 *     el.innerHTML = '<div>This is my custom sidebar content</div>';
 *   }
 * });
 * 
 * // React component example
 * app.extensionManager.registerSidebarTab({
 *   id: "reactSidebar",
 *   icon: "mdi mdi-react",
 *   title: "React Tab",
 *   type: "custom",
 *   render: (el) => {
 *     const container = document.createElement("div");
 *     el.appendChild(container);
 *     ReactDOM.createRoot(container).render(<YourComponent />);
 *   }
 * });
 * ```
 */

// Additional interfaces for internal use
export interface ExtensionManager {
  registerSidebarTab(config: SidebarTabConfig): void;
}

export interface Graph {
  _nodes: any[];
  links: Record<string, any>;
}

export interface API {
  addEventListener(event: string, callback: () => void): void;
  removeEventListener(event: string, callback: () => void): void;
} 
