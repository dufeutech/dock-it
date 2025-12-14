/**
 * Web Component Bundle Entry Point
 * Auto-registers <lumino-dock> custom element
 */

import { LuminoDock, type LuminoDockAPI } from "./web-component";
import Widget, { type MyWidgetOptions } from "./components/widget";
import { setTheme, type DockTheme, defaultTheme } from "./inject-styles";
import type { DockerConfig, RenderContext, RenderFn, SerializedLayout } from "./docker";

// Export for ESM consumers
export { LuminoDock, Widget, setTheme, defaultTheme };
export type { LuminoDockAPI, MyWidgetOptions, DockTheme, DockerConfig, RenderContext, RenderFn, SerializedLayout };

// Expose on window for IIFE consumers
if (typeof window !== "undefined") {
  (window as any).LuminoEasy = {
    LuminoDock,
    Widget,
    setTheme,
    defaultTheme,
  };
}
