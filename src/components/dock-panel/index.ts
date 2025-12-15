import { DockPanel, TabBar, Widget } from "@lumino/widgets";

/** Tab node configuration */
export interface TabNodeConfig {
  readonly tab: HTMLElement;
  readonly tabBar: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly view: Element | null;
  readonly widget: Widget | null;
  readonly closable: boolean;
}

/** Ensure a toolbar exists in a TabBar, returns it */
function ensureToolbar(tabBar: HTMLElement): HTMLElement {
  let toolbar = tabBar.querySelector(".lm-TabBar-toolbar") as HTMLElement;
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.className = "lm-TabBar-toolbar";
    tabBar.appendChild(toolbar);
  }
  return toolbar;
}

/** Enable horizontal scroll with mouse wheel on TabBar content */
function enableHorizontalScroll(tabBar: HTMLElement): void {
  const content = tabBar.querySelector(".lm-TabBar-content") as HTMLElement;
  if (!content || content.dataset.hscroll) return;
  content.dataset.hscroll = "true";

  content.addEventListener("wheel", (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      content.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

/** Tab lifecycle callbacks */
export interface TabCallbacks {
  readonly onTabAdded?: (config: TabNodeConfig) => void;
  readonly onTabRemoved?: (config: TabNodeConfig) => void;
  readonly onTabActivated?: (config: TabNodeConfig | null) => void;
}

/** Extended DockPanel options */
export interface MyDockPanelOptions extends DockPanel.IOptions {
  readonly tabCallbacks?: TabCallbacks;
}

/** Custom DockPanel with tab node tracking and cleanup */
export default class MyDockPanel extends DockPanel {
  private tabNodes = new Map<string, TabNodeConfig>();
  private tabCallbacks: TabCallbacks;
  private observer: MutationObserver | null = null;
  private _currentWidget: Widget | null = null;

  constructor(options?: MyDockPanelOptions) {
    super(options);
    this.tabCallbacks = options?.tabCallbacks ?? {};
    this.setupObserver();
  }

  /** Override addWidget to track tab bars for currentChanged signal */
  addWidget(widget: Widget, options?: DockPanel.IAddOptions): void {
    super.addWidget(widget, options);
    // After adding, connect to all tab bars
    this.connectTabBars();
  }

  /** Connect to all tab bars' currentChanged signals */
  private connectTabBars(): void {
    for (const tabBar of this.tabBars()) {
      // Avoid duplicate connections by checking if already connected
      if (!(tabBar as TabBar<Widget> & { __connected?: boolean }).__connected) {
        (tabBar as TabBar<Widget> & { __connected?: boolean }).__connected = true;
        tabBar.currentChanged.connect(this.handleTabBarCurrentChanged, this);
      }
    }
  }

  /** Handle currentChanged from any tab bar */
  private handleTabBarCurrentChanged(
    _sender: TabBar<Widget>,
    args: TabBar.ICurrentChangedArgs<Widget>
  ): void {
    const currentWidget = args.currentTitle?.owner ?? null;

    if (this._currentWidget === currentWidget) return;

    this._currentWidget = currentWidget;

    // Call the callback
    if (currentWidget) {
      const config = this.findConfigForWidget(currentWidget);
      this.tabCallbacks.onTabActivated?.(config);
    } else {
      this.tabCallbacks.onTabActivated?.(null);
    }
  }

  /** Find TabNodeConfig for a given widget */
  private findConfigForWidget(widget: Widget): TabNodeConfig | null {
    for (const config of this.tabNodes.values()) {
      if (config.widget === widget) {
        return config;
      }
    }
    return null;
  }

  /** Get all tracked tab nodes */
  get nodes(): TabNodeConfig[] {
    return Array.from(this.tabNodes.values());
  }

  /** Handle tab mutation callback */
  private handleTabMutation = (
    type: "added" | "removed",
    data: { closable: boolean; node: HTMLElement }
  ): void => {
    const tabId = data.node.id;

    if (type === "added") {
      const view = document.querySelector(`[aria-labelledby="${tabId}"]`);
      // Find the widget that owns this tab by matching the view's id
      const widget = view?.id
        ? Array.from(this.widgets()).find((w) => w.id === view.id) ?? null
        : null;
      // Find parent TabBar and ensure toolbar exists
      const tabBar = data.node.closest(".lm-TabBar") as HTMLElement;
      if (tabBar) {
        enableHorizontalScroll(tabBar);
      }
      const toolbar = tabBar ? ensureToolbar(tabBar) : document.createElement("div");
      const config: TabNodeConfig = {
        tab: data.node,
        tabBar,
        toolbar,
        view,
        widget,
        closable: data.closable,
      };
      this.tabNodes.set(tabId, config);
      this.tabCallbacks.onTabAdded?.(config);
    } else {
      const config = this.tabNodes.get(tabId);
      if (config) {
        this.tabNodes.delete(tabId);
        this.tabCallbacks.onTabRemoved?.(config);
      }
    }
  };

  /** Setup the mutation observer for tab tracking */
  private setupObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (!node.classList.contains("lm-TabBar-tab")) return;
          this.handleTabMutation("added", {
            closable: node.classList.contains("closable"),
            node,
          });
        });

        mutation.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (!node.classList.contains("lm-TabBar-tab")) return;
          this.handleTabMutation("removed", {
            closable: node.classList.contains("closable"),
            node,
          });
        });
      }
    });

    this.observer.observe(this.node, {
      attributes: false,
      childList: true,
      subtree: true,
    });
  }

  /** Handle child widget removal */
  protected onChildRemoved(msg: Widget.ChildMessage): void {
    super.onChildRemoved(msg);

    // Clean up any orphaned tab entries by checking if tab still exists in DOM
    for (const [tabId, config] of this.tabNodes) {
      if (!this.node.contains(config.tab)) {
        this.tabNodes.delete(tabId);
        this.tabCallbacks.onTabRemoved?.(config);
      }
    }
  }

  /** Dispose and cleanup observer */
  dispose(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.tabNodes.clear();
    super.dispose();
  }
}
