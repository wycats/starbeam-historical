import { QualifiedName } from "@starbeam/debug";
import { exhaustive } from "@starbeam/verify";
import {
  attrFor,
  AttributesBuffer,
  type Attributes,
  type AttributeValue,
  type AttrType,
} from "./attribute.js";
// eslint-disable-next-line import/no-cycle
import { escapeCommentValue, escapeTextValue } from "./escape.js";

export interface SerializeOptions {
  prefix: string;
}

export interface Serialize {
  /**
   * The `prefix` option instructs the serializeInto function to insert a
   * prefix, but only if there is anything to serialize.
   */
  serializeInto(buffer: Buffer, options?: SerializeOptions): void;
}

export class Buffer implements Serialize {
  static empty(): Buffer {
    return new Buffer([]);
  }

  readonly #parts: string[];

  constructor(parts: string[]) {
    this.#parts = parts;
  }

  append(part: string): void {
    this.#parts.push(part);
  }

  appending<T>(
    value: T | null,
    callback: (value: T) => void,
    options: SerializeOptions | null
  ): void {
    if (value !== null) {
      let prefix = options?.prefix;
      if (prefix) {
        this.append(prefix);
      }
      callback(value);
    }
  }

  serializeInto(buffer: Buffer): void {
    for (let part of this.#parts) {
      buffer.append(part);
    }
  }

  serialize(): string {
    return this.#parts.join("");
  }
}

export interface TrustedHTML {
  todo: "TrustedHTML";
}

export interface ContentBuffer {
  html(html: TrustedHTML): this;
  text(data: string): this;
  comment(data: string): this;
  element(
    tag: string,
    build: (builder: ElementHeadBuffer) => ElementBodyBuffer | void
  ): this;
}

export interface ElementState {
  readonly tag: string;
  readonly buffer: Buffer;
}

export interface ElementBodyState extends ElementState {
  readonly content: HtmlBuffer;
}

export class ElementBodyBuffer implements ContentBuffer {
  static create(state: ElementState): ElementBodyBuffer {
    return new ElementBodyBuffer({
      ...state,
      content: HtmlBuffer.of(state.buffer),
    });
  }

  static flush(builder: ElementBodyBuffer): void {
    builder.#buffer.append(`</${builder.#tag}>`);
  }

  readonly #state: ElementBodyState;

  private constructor(state: ElementBodyState) {
    this.#state = state;
  }

  get #tag(): string {
    return this.#state.tag;
  }

  get #buffer(): Buffer {
    return this.#state.buffer;
  }

  get #content(): HtmlBuffer {
    return this.#state.content;
  }

  empty(): this {
    return this;
  }

  html(html: TrustedHTML): this {
    this.#content.html(html);
    return this;
  }

  text(data: string): this {
    this.#content.text(data);
    return this;
  }

  comment(data: string): this {
    this.#content.comment(data);
    return this;
  }

  element(
    tag: string,
    build: (builder: ElementHeadBuffer) => ElementBodyBuffer | void
  ): this {
    this.#content.element(tag, build);
    return this;
  }
}

export type ElementBody = "normal" | "void" | "self-closing";

export interface ElementOptions {
  readonly body: ElementBody;
}

export class HtmlBuffer implements ContentBuffer {
  static create(): HtmlBuffer {
    return new HtmlBuffer(Buffer.empty());
  }

  static of(buffer: Buffer): HtmlBuffer {
    return new HtmlBuffer(buffer);
  }

  readonly #buffer: Buffer;

  private constructor(buffer: Buffer) {
    this.#buffer = buffer;
  }

  html(_data: TrustedHTML): this {
    throw Error("todo: Insert HTML");
  }

  text(data: string): this {
    this.#buffer.append(escapeTextValue(data));
    return this;
  }

  comment(data: string): this {
    this.#buffer.append(`<!--`);
    this.#buffer.append(escapeCommentValue(data));
    this.#buffer.append(`-->`);
    return this;
  }

  element(
    tag: string,
    build: (builder: ElementHeadBuffer) => ElementBodyBuffer | void
  ): this {
    let head = ElementHeadBuffer.tagged(tag, this.#buffer);
    let body = build(head);

    if (body) {
      ElementBodyBuffer.flush(body);
    }

    return this;
  }

  serialize(): string {
    return this.#buffer.serialize();
  }
}

export class ElementHeadBuffer {
  static tagged(tag: string, buffer: Buffer): ElementHeadBuffer {
    return new ElementHeadBuffer({ tag, buffer });
  }

  readonly #state: ElementState;
  readonly #attributes = AttributesBuffer.empty();

  private constructor(state: ElementState) {
    this.#state = state;
  }

  get #tag(): string {
    return this.#state.tag;
  }

  get #buffer(): Buffer {
    return this.#state.buffer;
  }

  attrs(map: Attributes): this {
    for (let [qualifiedName, attrValue] of map) {
      this.attr(qualifiedName, this.#normalizeAttrValue(attrValue));
    }

    return this;
  }

  attr(qualifiedName: string, attrValue: string | null | AttributeValue): this {
    let { value, type } = this.#normalizeAttrValue(attrValue);
    let attribute = attrFor(QualifiedName(qualifiedName), value, type);
    this.#attributes.initialize(attribute);
    return this;
  }

  idempotentAttr(qualifiedName: string, attrValue: string | null) {
    let attribute = attrFor(
      QualifiedName(qualifiedName),
      attrValue,
      "idempotent"
    );
    this.#attributes.idempotent(attribute);
    return this;
  }

  concatAttr(qualifiedName: string, value: string, separator: string): this {
    let attribute = attrFor(QualifiedName(qualifiedName), value, [
      "concat",
      separator,
    ]);
    this.#attributes.idempotent(attribute);
    return this;
  }

  /**
   * This is for splattributes
   */
  mergeAttr(qualifiedName: string, value: string | null): this {
    this.#attributes.merge(QualifiedName(qualifiedName), value);
    return this;
  }

  #normalizeAttrValue(attr: string | null | AttributeValue): {
    value: string | null;
    type: AttrType;
  } {
    if (attr === null || typeof attr === "string") {
      return { value: attr, type: "default" };
    } else {
      return { type: "default", ...attr };
    }
  }

  #flush(options: ElementOptions) {
    this.#buffer.append(`<${this.#tag}`);
    this.#attributes.serializeInto(this.#buffer);

    switch (options.body) {
      case "normal":
      case "void":
        this.#buffer.append(`>`);
        break;
      case "self-closing":
        this.#buffer.append(` />`);
        break;
      default:
        exhaustive(options.body);
    }
  }

  body(): ElementBodyBuffer {
    this.#flush({ body: "normal" });
    return ElementBodyBuffer.create(this.#state);
  }

  empty(type: ElementBody = "normal"): void {
    this.#flush({ body: type });

    if (type === "normal") {
      this.#buffer.append(`</${this.#tag}>`);
    }
  }
}
