import type { ReactiveMetadata } from "../core/metadata.js";
import type { RenderedProgramNode } from "../program-node/program-node.js";
import { LOGGER } from "../strippable/trace.js";

export class RenderedRoot<Container> {
  static create<Container>({
    rendered,
    container,
  }: {
    rendered: RenderedProgramNode<Container>;
    container: Container;
  }) {
    return new RenderedRoot(rendered, container);
  }

  readonly #rendered: RenderedProgramNode<Container>;
  readonly #container: Container;

  private constructor(
    rendered: RenderedProgramNode<Container>,
    container: Container
  ) {
    this.#rendered = rendered;
    this.#container = container;
  }

  get metadata(): ReactiveMetadata {
    return this.#rendered.metadata;
  }

  /**
   * Eagerly exchange all tokens for their DOM representations. This is
   * primarily useful if you want to look at the DOM without markers.
   */
  initialize(): this {
    LOGGER.trace.group(`\ninitializing rendered root`, () =>
      this.#rendered.initialize(this.#container)
    );

    return this;
  }

  poll(): void {
    LOGGER.trace.group(`\npolling rendered root`, () =>
      this.#rendered.poll(this.#container)
    );
  }
}
