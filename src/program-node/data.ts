import type * as minimal from "@domtree/minimal";
import type { ContentBuffer } from "../dom/buffer/body";
import { RangeSnapshot, RANGE_SNAPSHOT } from "../dom/streaming/cursor";
import type { Dehydrated, LazyDOM } from "../dom/streaming/token";
import { ContentConstructor, TOKEN } from "../dom/streaming/tree-constructor";
import type { Reactive } from "../reactive/core";
import type { ReactiveMetadata } from "../reactive/metadata";
import { mutable } from "../strippable/minimal";
import { AbstractContentProgramNode } from "./interfaces/program-node";
import { RenderedContent } from "./interfaces/rendered-content";

export abstract class CharacterDataProgramNode extends AbstractContentProgramNode<RenderedCharacterData> {
  static text(reactive: Reactive<string>): TextProgramNode {
    return TextProgramNode.of(reactive);
  }

  static comment(reactive: Reactive<string>): CommentProgramNode {
    return CommentProgramNode.of(reactive);
  }

  readonly #reactive: Reactive<string>;

  protected constructor(reactive: Reactive<string>) {
    super();
    this.#reactive = reactive;
  }

  get metadata(): ReactiveMetadata {
    return this.#reactive.metadata;
  }

  render(buffer: ContentConstructor<ContentBuffer>): RenderedCharacterData {
    let token = this.append(buffer, this.#reactive.current);
    return RenderedCharacterData.create(this.#reactive, token.dom);
  }

  abstract append(
    buffer: ContentConstructor<ContentBuffer>,
    data: string
  ): Dehydrated<minimal.CharacterData>;
}

export class TextProgramNode extends CharacterDataProgramNode {
  static of(reactive: Reactive<string>): TextProgramNode {
    return new TextProgramNode(reactive);
  }

  append(buffer: ContentConstructor, data: string): Dehydrated<minimal.Text> {
    return buffer.text(data, TOKEN);
  }
}

export class CommentProgramNode extends CharacterDataProgramNode {
  static of(reactive: Reactive<string>): CommentProgramNode {
    return new CommentProgramNode(reactive);
  }

  append(
    buffer: ContentConstructor,
    data: string
  ): Dehydrated<minimal.Comment> {
    return buffer.comment(data, TOKEN);
  }
}

export class RenderedCharacterData extends RenderedContent {
  static create(
    reactive: Reactive<string>,
    node: LazyDOM<minimal.CharacterData>
  ) {
    return new RenderedCharacterData(reactive, node);
  }

  #reactive: Reactive<string>;
  #node: LazyDOM<minimal.CharacterData>;

  protected constructor(
    reactive: Reactive<string>,
    node: LazyDOM<minimal.CharacterData>
  ) {
    super();
    this.#reactive = reactive;
    this.#node = node;
  }

  get metadata(): ReactiveMetadata {
    return this.#reactive.metadata;
  }

  initialize(inside: minimal.ParentNode): void {
    this.#node.get(inside);
  }

  poll(inside: minimal.ParentNode): void {
    mutable(this.#node.get(inside)).data = this.#reactive.current;
  }

  [RANGE_SNAPSHOT](inside: minimal.ParentNode): RangeSnapshot {
    return RangeSnapshot.create(this.#node.environment, this.#node.get(inside));
  }
}