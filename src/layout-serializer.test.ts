import { describe, it, expect } from "vitest";
import {
  serializeLayout,
  deserializeLayout,
  layoutToJSON,
  jsonToSerializedLayout,
  type SerializedLayout,
  type WidgetConfig,
} from "./layout-serializer";

/** Mock widget - simulates Lumino widget structure */
const createMockWidget = (kind: string, id: string, label?: string) => ({
  id,
  kind,
  node: { id },
  title: { label: label ?? kind, iconClass: "", className: "" },
});

/** Mock config for deserialization tests */
const createMockConfig = (kind: string, id?: string, label?: string): WidgetConfig => ({
  id: id ?? `mock-${kind}`,
  kind,
  label: label ?? kind,
});

describe("layout-serializer", () => {
  it("handles null layout.main", () => {
    const layout = { main: null };
    const serialized = serializeLayout(layout as any);
    expect(serialized.main).toBeNull();
  });

  it("serializes a simple tab-area", () => {
    const layout = {
      main: {
        type: "tab-area" as const,
        widgets: [
          createMockWidget("CODE_EDITOR", "widget-1"),
          createMockWidget("TERMINAL", "widget-2"),
        ],
        currentIndex: 0,
      },
    };

    const serialized = serializeLayout(layout as any);

    expect(serialized.main).not.toBeNull();
    expect(serialized.main!.type).toBe("tab-area");
    if (serialized.main!.type === "tab-area") {
      expect(serialized.main!.widgets.map((w) => w.kind)).toEqual(["CODE_EDITOR", "TERMINAL"]);
      expect(serialized.main!.currentIndex).toBe(0);
    }
  });

  it("serializes a split-area with nested tabs", () => {
    const layout = {
      main: {
        type: "split-area" as const,
        orientation: "horizontal" as const,
        sizes: [0.5, 0.5],
        children: [
          {
            type: "tab-area" as const,
            widgets: [createMockWidget("CODE_EDITOR", "widget-1")],
            currentIndex: 0,
          },
          {
            type: "tab-area" as const,
            widgets: [
              createMockWidget("TERMINAL", "widget-2"),
              createMockWidget("OUTPUT", "widget-3"),
            ],
            currentIndex: 1,
          },
        ],
      },
    };

    const serialized = serializeLayout(layout as any);

    expect(serialized.main!.type).toBe("split-area");
    if (serialized.main!.type === "split-area") {
      expect(serialized.main!.orientation).toBe("horizontal");
      expect(serialized.main!.children).toHaveLength(2);
    }
  });

  it("serializes deeply nested layout", () => {
    const layout = {
      main: {
        type: "split-area" as const,
        orientation: "horizontal" as const,
        sizes: [0.3, 0.7],
        children: [
          {
            type: "tab-area" as const,
            widgets: [createMockWidget("SIDEBAR", "sidebar-1")],
            currentIndex: 0,
          },
          {
            type: "split-area" as const,
            orientation: "vertical" as const,
            sizes: [0.6, 0.4],
            children: [
              {
                type: "tab-area" as const,
                widgets: [
                  createMockWidget("CODE_EDITOR", "editor-1"),
                  createMockWidget("CODE_EDITOR", "editor-2"),
                ],
                currentIndex: 0,
              },
              {
                type: "tab-area" as const,
                widgets: [createMockWidget("TERMINAL", "term-1")],
                currentIndex: 0,
              },
            ],
          },
        ],
      },
    };

    const serialized = serializeLayout(layout as any);
    expect(serialized.main!.type).toBe("split-area");
  });

  it("converts to JSON string and back", () => {
    const layout = {
      main: {
        type: "tab-area" as const,
        widgets: [
          createMockWidget("CODE_EDITOR", "w1"),
          createMockWidget("BROWSER", "w2"),
        ],
        currentIndex: 1,
      },
    };

    const json = layoutToJSON(layout as any);
    const parsed = jsonToSerializedLayout(json);

    expect(parsed.main).not.toBeNull();
    expect(parsed.main!.type).toBe("tab-area");
  });

  it("deserializes layout with widget factory", () => {
    const serialized: SerializedLayout = {
      main: {
        type: "split-area",
        orientation: "horizontal",
        sizes: [0.5, 0.5],
        children: [
          {
            type: "tab-area",
            widgets: [createMockConfig("CODE_EDITOR", "ed-1")],
            currentIndex: 0,
          },
          {
            type: "tab-area",
            widgets: [createMockConfig("TERMINAL", "term-1"), createMockConfig("OUTPUT", "out-1")],
            currentIndex: 0,
          },
        ],
      },
    };

    let createdCount = 0;
    const factory = (config: WidgetConfig) => {
      createdCount++;
      return createMockWidget(config.kind, `restored-${createdCount}`, config.label);
    };

    const restored = deserializeLayout(serialized, factory as any);

    expect(createdCount).toBe(3);
    expect(restored.main).not.toBeNull();
  });

  it("full round-trip: serialize -> JSON -> deserialize", () => {
    const original = {
      main: {
        type: "split-area" as const,
        orientation: "vertical" as const,
        sizes: [0.7, 0.3],
        children: [
          {
            type: "tab-area" as const,
            widgets: [
              createMockWidget("CODE_EDITOR", "main-editor"),
              createMockWidget("PREVIEW", "preview-pane"),
            ],
            currentIndex: 0,
          },
          {
            type: "tab-area" as const,
            widgets: [createMockWidget("CONSOLE", "debug-console")],
            currentIndex: 0,
          },
        ],
      },
    };

    const json = layoutToJSON(original as any);
    const parsed = jsonToSerializedLayout(json);

    const widgetMap: Record<string, number> = {};
    const factory = (config: WidgetConfig) => {
      widgetMap[config.kind] = (widgetMap[config.kind] || 0) + 1;
      return createMockWidget(config.kind, `new-${config.kind}-${widgetMap[config.kind]}`, config.label);
    };
    const restored = deserializeLayout(parsed, factory as any);

    expect(widgetMap).toEqual({
      CODE_EDITOR: 1,
      PREVIEW: 1,
      CONSOLE: 1,
    });
    expect(restored.main?.type).toBe("split-area");
  });

  it("deep nested: alternating horizontal/vertical splits (4 levels)", () => {
    const layout = {
      main: {
        type: "split-area" as const,
        orientation: "horizontal" as const,
        sizes: [0.25, 0.75],
        children: [
          {
            type: "split-area" as const,
            orientation: "vertical" as const,
            sizes: [0.7, 0.3],
            children: [
              {
                type: "split-area" as const,
                orientation: "horizontal" as const,
                sizes: [0.5, 0.5],
                children: [
                  { type: "tab-area" as const, widgets: [createMockWidget("FILE_TREE", "ft-1")], currentIndex: 0 },
                  { type: "tab-area" as const, widgets: [createMockWidget("SEARCH", "search-1")], currentIndex: 0 },
                ],
              },
              { type: "tab-area" as const, widgets: [createMockWidget("GIT_PANEL", "git-1")], currentIndex: 0 },
            ],
          },
          {
            type: "split-area" as const,
            orientation: "vertical" as const,
            sizes: [0.6, 0.4],
            children: [
              {
                type: "split-area" as const,
                orientation: "horizontal" as const,
                sizes: [0.6, 0.4],
                children: [
                  { type: "tab-area" as const, widgets: [createMockWidget("CODE_EDITOR", "ed-1"), createMockWidget("CODE_EDITOR", "ed-2")], currentIndex: 1 },
                  { type: "tab-area" as const, widgets: [createMockWidget("CODE_EDITOR", "ed-3")], currentIndex: 0 },
                ],
              },
              {
                type: "split-area" as const,
                orientation: "horizontal" as const,
                sizes: [0.5, 0.5],
                children: [
                  { type: "tab-area" as const, widgets: [createMockWidget("TERMINAL", "term-1")], currentIndex: 0 },
                  { type: "tab-area" as const, widgets: [createMockWidget("OUTPUT", "out-1"), createMockWidget("PROBLEMS", "prob-1")], currentIndex: 0 },
                ],
              },
            ],
          },
        ],
      },
    };

    const serialized = serializeLayout(layout as any);

    expect(serialized.main!.type).toBe("split-area");
    if (serialized.main!.type === "split-area") {
      expect(serialized.main!.orientation).toBe("horizontal");
      expect(serialized.main!.children).toHaveLength(2);

      const left = serialized.main!.children[0];
      expect(left.type).toBe("split-area");
      if (left.type === "split-area") {
        expect(left.orientation).toBe("vertical");
      }

      const right = serialized.main!.children[1];
      expect(right.type).toBe("split-area");
      if (right.type === "split-area") {
        expect(right.orientation).toBe("vertical");
      }
    }
  });

  it("deep nested round-trip preserves structure and widget order", () => {
    const original = {
      main: {
        type: "split-area" as const,
        orientation: "vertical" as const,
        sizes: [0.8, 0.2],
        children: [
          {
            type: "split-area" as const,
            orientation: "horizontal" as const,
            sizes: [0.2, 0.8],
            children: [
              {
                type: "split-area" as const,
                orientation: "vertical" as const,
                sizes: [0.5, 0.5],
                children: [
                  { type: "tab-area" as const, widgets: [createMockWidget("EXPLORER", "exp-1")], currentIndex: 0 },
                  { type: "tab-area" as const, widgets: [createMockWidget("OUTLINE", "out-1")], currentIndex: 0 },
                ],
              },
              {
                type: "split-area" as const,
                orientation: "vertical" as const,
                sizes: [0.7, 0.3],
                children: [
                  {
                    type: "split-area" as const,
                    orientation: "horizontal" as const,
                    sizes: [0.33, 0.33, 0.34],
                    children: [
                      { type: "tab-area" as const, widgets: [createMockWidget("EDITOR", "ed-1"), createMockWidget("EDITOR", "ed-2")], currentIndex: 0 },
                      { type: "tab-area" as const, widgets: [createMockWidget("EDITOR", "ed-3")], currentIndex: 0 },
                      {
                        type: "split-area" as const,
                        orientation: "vertical" as const,
                        sizes: [0.5, 0.5],
                        children: [
                          { type: "tab-area" as const, widgets: [createMockWidget("PREVIEW", "prev-1")], currentIndex: 0 },
                          { type: "tab-area" as const, widgets: [createMockWidget("DIFF", "diff-1")], currentIndex: 0 },
                        ],
                      },
                    ],
                  },
                  { type: "tab-area" as const, widgets: [createMockWidget("TERMINAL", "term-1"), createMockWidget("DEBUG", "debug-1"), createMockWidget("OUTPUT", "output-1")], currentIndex: 2 },
                ],
              },
            ],
          },
          { type: "tab-area" as const, widgets: [createMockWidget("STATUSBAR", "status-1")], currentIndex: 0 },
        ],
      },
    };

    const json = layoutToJSON(original as any);
    const parsed = jsonToSerializedLayout(json);

    const widgetOrder: string[] = [];
    const factory = (config: WidgetConfig) => {
      widgetOrder.push(config.kind);
      return createMockWidget(config.kind, config.id, config.label);
    };
    const restored = deserializeLayout(parsed, factory as any);

    expect(widgetOrder).toEqual([
      "EXPLORER", "OUTLINE",
      "EDITOR", "EDITOR", "EDITOR",
      "PREVIEW", "DIFF",
      "TERMINAL", "DEBUG", "OUTPUT",
      "STATUSBAR",
    ]);

    expect(restored.main?.type).toBe("split-area");

    const json2 = layoutToJSON(restored);
    const parsed2 = jsonToSerializedLayout(json2);
    expect(parsed2).toEqual(parsed);
  });

  it("handles 3-way splits at multiple levels", () => {
    const layout = {
      main: {
        type: "split-area" as const,
        orientation: "horizontal" as const,
        sizes: [0.25, 0.5, 0.25],
        children: [
          { type: "tab-area" as const, widgets: [createMockWidget("LEFT_PANEL", "left-1")], currentIndex: 0 },
          {
            type: "split-area" as const,
            orientation: "vertical" as const,
            sizes: [0.33, 0.34, 0.33],
            children: [
              { type: "tab-area" as const, widgets: [createMockWidget("TOP", "top-1")], currentIndex: 0 },
              { type: "tab-area" as const, widgets: [createMockWidget("MIDDLE", "mid-1")], currentIndex: 0 },
              { type: "tab-area" as const, widgets: [createMockWidget("BOTTOM", "bot-1")], currentIndex: 0 },
            ],
          },
          { type: "tab-area" as const, widgets: [createMockWidget("RIGHT_PANEL", "right-1")], currentIndex: 0 },
        ],
      },
    };

    const serialized = serializeLayout(layout as any);

    expect(serialized.main!.type).toBe("split-area");
    if (serialized.main!.type === "split-area") {
      expect(serialized.main!.sizes).toEqual([0.25, 0.5, 0.25]);
      expect(serialized.main!.children).toHaveLength(3);

      const middle = serialized.main!.children[1];
      if (middle.type === "split-area") {
        expect(middle.sizes).toEqual([0.33, 0.34, 0.33]);
        expect(middle.children).toHaveLength(3);
      }
    }
  });
});
