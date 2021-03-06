import type { Component } from "./program-node/component.js";
import { ElementProgramNode, ElementProgramNodeBuilder } from "./program-node/element.js";
import { type ListProgramNode } from "./program-node/list/loop.js";
import { CommentProgramNode, TextProgramNode } from "./program-node/data.js";
import type { ReactiveParameter } from "./reactive/parameter.js";
import { FragmentProgramNode, FragmentProgramNodeBuilder } from "./program-node/fragment.js";
import { Reactive } from "./reactive/reactive.js";
export declare const APPEND: unique symbol;
export declare class ReactiveDOM {
    text(data: Reactive<string>): TextProgramNode;
    comment(data: Reactive<string>): CommentProgramNode;
    element(tagName: Reactive<string> | string): ElementProgramNodeBuilder;
    element(tagName: Reactive<string> | string, callback: (builder: ElementProgramNodeBuilder) => void): ElementProgramNode;
    fragment(build: (builder: FragmentProgramNodeBuilder) => void): FragmentProgramNode;
    list<P extends ReactiveParameter>(iterable: Reactive<Iterable<P>>, component: Component<P>, key: (arg: P) => unknown): ListProgramNode;
}
export * from "./dom/buffer/body.js";
export * from "./dom/buffer/attribute.js";
export * from "./dom/environment.js";
