import { Docker, type DockerConfig } from "./docker";
import { injectStyles, setTheme, type DockTheme } from "./inject-styles";

/** Web component API interface */
export interface LuminoDockAPI extends Docker {
  /** Update the dock theme */
  setTheme(theme: DockTheme): void;
}

/** Web component that wraps Docker with el.api access */
export class LuminoDock extends HTMLElement {
  private _docker: Docker | null = null;
  private _config: DockerConfig | null = null;
  private _theme: DockTheme = {};

  /** Ensure docker is attached, re-attaching if disposed */
  private _ensureAttached(): Docker {
    if (!this._config) {
      throw new Error("Docker not initialized. Set config first.");
    }
    if (!this._docker || this._docker.isDisposed) {
      this._docker = new Docker(this._config);
      this._docker.attach(this);
    }
    return this._docker;
  }

  /** Access the Docker API with theme control */
  get api(): LuminoDockAPI {
    if (!this._config) {
      throw new Error("Docker not initialized. Set config first.");
    }

    const self = this;

    // Return Docker proxy with auto-attach and setTheme
    return new Proxy({} as Docker, {
      get(_, prop) {
        if (prop === "setTheme") {
          return (theme: DockTheme) => {
            self._theme = { ...self._theme, ...theme };
            setTheme(self._theme);
          };
        }

        // Auto-attach for methods that need it
        const docker = self._ensureAttached();
        const value = Reflect.get(docker, prop, docker);
        return typeof value === "function" ? value.bind(docker) : value;
      },
    }) as LuminoDockAPI;
  }

  /** Configure and initialize the dock */
  set config(cfg: DockerConfig) {
    this._config = cfg;
    this._init();
  }

  get config(): DockerConfig | null {
    return this._config;
  }

  /** Set initial theme */
  set theme(theme: DockTheme) {
    this._theme = theme;
    setTheme(theme);
  }

  get theme(): DockTheme {
    return this._theme;
  }

  connectedCallback(): void {
    injectStyles(this._theme);
    this.style.display = "block";
    this.style.width = "100%";
    this.style.height = "100%";

    if (this._config) {
      this._init();
    }
  }

  disconnectedCallback(): void {
    this._docker?.dispose();
    this._docker = null;
  }

  private _init(): void {
    if (!this._config || !this.isConnected) return;

    // Dispose existing
    this._docker?.dispose();

    // Create new docker
    this._docker = new Docker(this._config);
    this._docker.attach(this);

    // Dispatch ready event
    this.dispatchEvent(new CustomEvent("ready", { detail: this.api }));
  }

  /** Force layout update (call on resize) */
  update(): void {
    this._docker?.update();
  }
}

// Register the custom element
if (typeof customElements !== "undefined" && !customElements.get("lumino-dock")) {
  customElements.define("lumino-dock", LuminoDock);
}

declare global {
  interface HTMLElementTagNameMap {
    "lumino-dock": LuminoDock;
  }
}
