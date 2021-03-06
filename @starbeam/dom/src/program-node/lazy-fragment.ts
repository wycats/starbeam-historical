import type { minimal } from "@domtree/flavors";
import { is } from "@starbeam/core";
import { as, verified } from "@starbeam/verify";
import type { DomEnvironment } from "../dom.js";
import type { ContentRange } from "../dom/streaming/compatible-dom.js";
import type { LazyDOM } from "../dom/streaming/token.js";

export class LazyFragment {
  static of(lazy: LazyDOM<ContentRange>): LazyFragment {
    return new LazyFragment(lazy, undefined);
  }

  readonly #lazy: LazyDOM<ContentRange>;
  #placeholder: minimal.ChildNode | null | undefined;

  constructor(
    lazy: LazyDOM<ContentRange>,
    placeholder: minimal.ChildNode | null | undefined
  ) {
    this.#lazy = lazy;
    this.#placeholder = placeholder;
  }

  get environment(): DomEnvironment {
    return this.#lazy.environment;
  }

  initialize(inside: minimal.ParentNode): void {
    this.#lazy.get(inside);
  }

  get(inside: minimal.ParentNode): minimal.ChildNode {
    if (this.#placeholder === undefined) {
      this.#placeholder = verified(
        this.#lazy.get(inside).asNode(),
        is.Comment,
        as(`the ContentRange for a rendered list`).when(`the list was empty`)
      );
    }

    return verified(
      this.#placeholder,
      is.Present,
      as(`The ContentRange for a rendered list`).when(`the list was empty`)
    );
  }

  set(placeholder: minimal.ChildNode | null): void {
    this.#placeholder = placeholder;
  }
}
