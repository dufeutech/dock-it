import { Widget } from "@lumino/widgets";

/** Unique ID generator with collision prevention */
class IdGenerator {
  private counter = 0;
  private lastTimestamp = 0;
  private readonly group: string;
  private readonly machineId: number;

  constructor(group = "main") {
    this.group = group;
    this.machineId = Math.random() & 255;
  }

  generate(): string {
    const now = Date.now();
    this.counter = now === this.lastTimestamp ? (this.counter + 1) & 0xffff : 0;
    this.lastTimestamp = now;

    const hex = (v: number, len: number) => v.toString(16).padStart(len, "0");
    const rand = () => Math.random().toString(36).slice(2);

    return `widget-${this.group}-${rand()}${rand()}-${hex(now, 12)}${hex(
      this.machineId,
      2
    )}${hex(this.counter, 4)}${hex((Math.random() * 0xffff) | 0, 4)}`;
  }
}

const idGenerator = new IdGenerator("code-editor");

/** Context passed to render method */
export interface RenderContext {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly closable: boolean;
  readonly kind: string;
  readonly node: HTMLElement;
}

/** Render function type */
export type RenderFn = (ctx: RenderContext) => HTMLElement | string | void;

/** Widget options */
export interface MyWidgetOptions {
  readonly id?: string;
  readonly label?: string;
  readonly icon?: string;
  readonly closable?: boolean;
  readonly kind?: string;
  readonly render?: RenderFn;
}

/** Default render function */
const defaultRender: RenderFn = (ctx) => `
  <h2>${ctx.label}</h2>
  <button>Click me!</button>
  <p>Status: <span class="status">Idle</span></p>
`;

/** Custom widget with kind property for serialization */
export default class MyWidget extends Widget {
  readonly kind: string;
  private readonly _render: RenderFn;

  constructor({
    id = idGenerator.generate(),
    label = "",
    icon = "",
    closable = false,
    kind = "CODE_EDITOR",
    render = defaultRender,
  }: MyWidgetOptions = {}) {
    super();

    this.id = id;
    this.kind = kind;
    this._render = render;

    this.title.label = label;
    this.title.closable = false;
    this.title.className = `code-editor-widget-tab-class${
      closable ? " closable" : ""
    }`;
    this.title.iconClass = ["editor-icon", icon].filter(Boolean).join(" ");

    this.addClass("my-widget");
    this.node.dataset.closable = String(closable);

    const content = document.createElement("div");
    content.className = "code-editor-widget-content-class";

    const ctx: RenderContext = { id, label, icon, closable, kind, node: content };
    const result = this._render(ctx);

    if (result instanceof HTMLElement) {
      content.appendChild(result);
    } else if (typeof result === "string") {
      content.innerHTML = result;
    }

    this.node.appendChild(content);
  }
}
