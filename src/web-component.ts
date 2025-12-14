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

  /** Access the Docker API with theme control */
  get api(): LuminoDockAPI {
    if (!this._docker) {
      throw new Error("Docker not initialized. Set config first.");
    }

    const docker = this._docker;
    const self = this;

    // Return Docker with added setTheme method
    return new Proxy(docker, {
      get(target, prop) {
        if (prop === "setTheme") {
          return (theme: DockTheme) => {
            self._theme = { ...self._theme, ...theme };
            setTheme(self._theme);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
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
