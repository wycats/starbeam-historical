import type { UnsafeAny, VerifierFunction } from "@starbeam/fundamental";
import { abstractify, Abstraction } from "@starbeam/trace-internals";
import { DebugInformation } from "./core.js";
import { isPresent } from "./presence.js";
import {
  as,
  CreatedContext,
  DescribedContext,
  VerifyContext,
} from "./verify-context.js";

/**
 * @strip.value value
 */
export function present<T>(
  value: T | null | undefined,
  info?: DebugInformation
): T {
  if (value === null) {
    throw Error(DebugInformation.message(info, "unexpected null"));
  } else if (value === undefined) {
    throw Error(DebugInformation.message(info, "unexpected undefined"));
  } else {
    return value;
  }
}

export type VerifierUnion<V extends VerifierFunction<any, any>> =
  V extends VerifierFunction<infer In, infer Out>
    ? VerifierFunction<In, Out>
    : never;

const VERIFIER = new WeakMap<
  VerifierFunction<unknown, unknown>,
  CreatedContext<unknown>
>();

export const Verifier = {
  implement<In, Out extends In>(
    verifier: VerifierFunction<In, Out>,
    message: CreatedContext<In>
  ): void {
    VERIFIER.set(
      verifier as VerifierFunction<unknown, unknown>,
      message as CreatedContext<unknown>
    );
  },

  is: <In, Out extends In>(
    verifier: unknown
  ): verifier is VerifierFunction<In, Out> => {
    return typeof verifier === "function" && VERIFIER.has(verifier as any);
  },

  context<In>(verifier: VerifierFunction<In, In>): CreatedContext<In> {
    return verified(
      VERIFIER.get(verifier as VerifierFunction<unknown, unknown>),
      isPresent
    );
  },

  assertion<In>(
    verifier: VerifierFunction<In, In>,
    updates: IntoBuildContext | undefined,
    value: In
  ): DebugInformation {
    let created =
      VERIFIER.get(verifier as VerifierFunction<unknown, unknown>) ??
      as("value");

    return created.update(IntoBuildContext.create(updates)).finalize(value)
      .message;
  },
};

// const DEFAULT_VERIFIER_MESSAGE: VerifierMessage<unknown> = {
//   context: as("value"),
//   message: ({ expected, relationship }) =>
//     relationship
//       ? `Expected ${input} to be ${description}`
//       : `${input} verification failed`,
// };

export interface PartialVerifier<In, Out extends In> {
  (value: In): value is Out;
  default?: VerifyContext;
  message?: (context: VerifyContext, value: In) => DebugInformation;
}

export type NormalizeContext<In> = (
  value: In,
  context: VerifyContext
) => VerifyContext;

export type IntoBuildContext = CreatedContext | PartialVerifyContext;

function isCreatedContext(
  context?: IntoBuildContext
): context is CreatedContext {
  return context !== undefined && context instanceof CreatedContext;
}

const IntoBuildContext = {
  create(into: IntoBuildContext | undefined): CreatedContext {
    if (isCreatedContext(into)) {
      return into;
    } else if (into === undefined) {
      return CreatedContext.DEFAULT;
    } else {
      return DescribedContext.of(VerifyContext.from(into)).assert();
    }
  },
} as const;

export interface CompleteContext extends VerifyContext {
  readonly actual: string | null;
}

export interface PartialVerifyContext {
  when?: string;
  expected?: string;
  relationship?: {
    kind: "to be" | "to have" | "to";
    description: string;
  };
}

export interface MutableVerifyContext {
  expected: string;
  relationship?: {
    kind: "to be" | "to have" | "to";
    description: string;
  };
  when?: string;
}

const verifyValue: <In, Out extends In>(
  value: In,
  {
    verifier,
    context,
  }: {
    verifier: VerifierFunction<In, Out>;
    context?: IntoBuildContext;
  }
) => asserts value is Out = abstractify((value, { verifier, context }) => {
  assertCondition(verifier(value), () =>
    Verifier.assertion(
      verifier,
      IntoBuildContext.create(context).finalize(value).context,
      value
    )
  );
});

/** @internal */
export const assertCondition: (
  condition: UnsafeAny,
  info: () => DebugInformation
) => asserts condition = abstractify((condition, info) => {
  if (condition === true) {
    return;
  }

  // eslint-disable-next-line no-debugger
  debugger;
  let message = `Unexpected: ${info()}`;
  console.assert(condition, message);
  Abstraction.throw(message);
});

/**
 * @strip.statement
 */
export function verify<In, Out extends In>(
  value: In,
  verifier: VerifierFunction<In, Out>,
  context?: IntoBuildContext
): asserts value is Out {
  return verifyValue(value, { verifier, context });
}

/**
 * @strip.value value
 */
export function verified<Out extends In, In = unknown>(
  value: In,
  verifier: (value: In) => value is Out,
  context?: IntoBuildContext
): Out {
  verifyValue(value, { verifier, context });
  return value;
}

export function exhaustive(_value: never, type?: string): never {
  if (type) {
    throw Error(`unexpected types left in ${type}`);
  } else {
    throw Error(`unexpected types left`);
  }
}
