import { Verifier } from "./assert.js";
import { expected } from "./verify-context.js";

export type Primitive =
  | string
  | number
  | boolean
  | symbol
  | bigint
  | null
  | undefined;

export function isValue<T extends Primitive>(value: T): Verifier<Primitive, T> {
  function verify(input: Primitive): input is T {
    return input === value;
  }

  Verifier.implement<Primitive, T>(
    verify,
    expected(`value`)
      .toBe(String(value))
      .butGot((actual) => String(actual))
  );

  return verify;
}