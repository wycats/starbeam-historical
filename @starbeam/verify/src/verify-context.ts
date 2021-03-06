import { assert } from "@starbeam/debug";
import type {
  CompleteContext,
  MutableVerifyContext,
  PartialVerifyContext,
} from "./assert.js";
import { isVerifyContext } from "./core.js";

export class DescribedContext {
  static of(context: VerifyContext): DescribedContext {
    return new DescribedContext(context);
  }

  static get DEFAULT(): DescribedContext {
    return expected("value").assert();
  }

  readonly #context: VerifyContext;

  private constructor(context: VerifyContext) {
    this.#context = context;
  }

  get context(): VerifyContext {
    return this.#context;
  }

  update(partial: PartialVerifyContext | undefined): DescribedContext {
    if (partial === undefined) {
      return this;
    } else {
      return DescribedContext.of(VerifyContext.merge(this.#context, partial));
    }
  }

  assert(): CreatedContext<unknown> {
    return CreatedContext.create(this.#context);
  }

  butGot<In>(actual: (value: In) => string): CreatedContext<In> {
    return CreatedContext.create(this.#context, actual);
  }
}

export interface Updater<In, NewIn extends In> {
  expected?(expected: string): string;
  relationship?(relationship: Relationship): Relationship;
  butGot?: (butGot: (value: In) => string) => (value: NewIn) => string;
}

export class CreatedContext<In = unknown> {
  static create<In>(
    context: VerifyContext,
    butGot?: (value: In) => string
  ): CreatedContext<In> {
    return new CreatedContext(context, butGot);
  }

  static get DEFAULT(): CreatedContext {
    return DescribedContext.DEFAULT.assert();
  }

  readonly #context: VerifyContext;
  readonly #butGot: undefined | ((value: In) => string);

  private constructor(context: VerifyContext, butGot?: (value: In) => string) {
    this.#context = context;
    this.#butGot = butGot;
  }

  get expected(): { label: string; relationship?: Relationship } {
    return {
      label: this.#context.expected,
      relationship: this.#context.relationship,
    };
  }

  update(partial: CreatedContext | undefined): CreatedContext<In> {
    if (partial === undefined) {
      return this;
    } else {
      return CreatedContext.create(
        VerifyContext.merge(this.#context, partial.#context),
        this.#butGot
      );
    }
  }

  updating<NewIn extends In>({
    expected: updateExpected,
    relationship: updateRelationship,
    butGot: updateButGot,
  }: Updater<In, NewIn>): CreatedContext<NewIn> {
    if (
      updateExpected === undefined &&
      updateRelationship === undefined &&
      updateButGot === undefined
    ) {
      return this;
    }

    let expected = updateExpected
      ? updateExpected(this.#context.expected)
      : this.#context.expected;

    let relationship =
      updateRelationship && this.#context.relationship
        ? updateRelationship(this.#context.relationship)
        : this.#context.relationship;

    let butGot =
      updateButGot && this.#butGot ? updateButGot(this.#butGot) : this.#butGot;

    return CreatedContext.create(
      VerifyContext.merge(this.#context, { expected, relationship }),
      butGot
    );
  }

  when(situation: string): CreatedContext<In> {
    return CreatedContext.create(
      VerifyContext.merge(this.#context, { when: situation }),
      this.#butGot
    );
  }

  butGot<In>(actual: (value: In) => string): CreatedContext<In> {
    assert(
      this.#butGot === undefined,
      `You should only call .butGot on a CreatedContext if it was not already called. If you want to *update* butGot, call updating({ butGot })`
    );

    return CreatedContext.create(this.#context, actual);
  }

  finalize(value: In): FinalizedContext {
    let actual = this.#butGot ? this.#butGot(value) : null;

    return FinalizedContext.of({
      ...this.#context,
      actual,
    });
  }
}

export class FinalizedContext {
  static of(context: CompleteContext): FinalizedContext {
    return new FinalizedContext(context);
  }

  #context: CompleteContext;

  protected constructor(context: CompleteContext) {
    this.#context = context;
  }

  get message(): string {
    let expected = this.#expected;
    let { actual } = this.#context;

    if (actual) {
      return `${expected}, but got ${actual}`;
    } else {
      return expected;
    }
  }

  get #expected(): string {
    let { expected, relationship, when } = this.#context;

    let expectation = `Expected ${expected}`;

    if (when) {
      expectation = `When ${when}, ${expectation}`;
    }

    if (relationship) {
      expectation = `${expectation} ${relationship.kind} ${relationship.description}`;
    }

    return expectation;
  }

  get context(): CompleteContext {
    return this.#context;
  }
}

export class ExpectedContext {
  static of(input: string): ExpectedContext {
    return new ExpectedContext(input);
  }

  readonly #expected: string;

  private constructor(input: string) {
    this.#expected = input;
  }

  assert(): DescribedContext {
    return DescribedContext.of({
      expected: this.#expected,
    });
  }

  to(relationship: Relationship): CreatedContext;
  to(kind: "be" | "have", description: string): CreatedContext;
  to(
    ...args: [kind: "be" | "have", description: string] | [Relationship]
  ): CreatedContext {
    const relationship = (
      typeof args[0] === "string"
        ? { kind: args[0], description: args[1] }
        : args[0]
    ) as Relationship;

    return DescribedContext.of({
      expected: this.#expected,
      relationship: relationship,
    }).assert();
  }

  toBe(description: string): CreatedContext {
    return DescribedContext.of({
      expected: this.#expected,
      relationship: {
        kind: "to be",
        description,
      },
    }).assert();
  }

  toHave(description: string): CreatedContext<unknown[]> {
    return DescribedContext.of({
      expected: this.#expected,
      relationship: {
        kind: "to have",
        description,
      },
    }).butGot((array) =>
      array.length === 1 ? `1 item` : `${array.length} items`
    );
  }
}

export function expected(input: string): ExpectedContext {
  return ExpectedContext.of(input);
}

export function as(input: string): CreatedContext {
  return DescribedContext.of({ expected: input }).assert();
}

export interface Relationship {
  readonly kind: "to be" | "to have" | "to";
  readonly description: string;
}

export interface VerifyContext extends PartialVerifyContext {
  readonly when?: string;
  readonly expected: string;
  readonly relationship?: Relationship;
}

export const VerifyContext = {
  withDefaults(
    context: VerifyContext,
    { relationship }: PartialVerifyContext
  ): VerifyContext {
    if (context.relationship === undefined) {
      return {
        ...context,
        relationship,
      };
    } else {
      return context;
    }
  },

  merge(left: VerifyContext, right: PartialVerifyContext): VerifyContext {
    let merged: MutableVerifyContext = { ...left };

    if (right.relationship) {
      merged.relationship = { ...right.relationship };
    }

    if (right.expected) {
      merged.expected = right.expected;
    }

    if (right.when) {
      merged.when = right.when;
    }

    return merged;
  },

  DEFAULT: VerifyContextFrom(undefined),
  from: VerifyContextFrom,
} as const;

function VerifyContextFrom(
  partial: PartialVerifyContext | undefined
): VerifyContext {
  if (partial === undefined) {
    return {
      expected: "value",
    };
  } else if (isVerifyContext(partial)) {
    return partial;
  } else {
    return {
      ...partial,
      expected: "value",
    };
  }
}
