export { assert, assertCondition, failure } from "./src/assert.js";
export { UNINITIALIZED } from "./src/constants.js";
export type {
  AnyDict,
  AnyIndex,
  AnyIndexValue,
  AnyKey,
  AnyRecord,
  InferArgument,
  InferReturn,
  Metaprogramming,
  UnsafeAny,
} from "./src/infer.js";
export {
  describeTypeofFor,
  isNull,
  isObject,
  isTypeof,
  type TypeForTypeOf,
  type TypeOf,
  type Verifier as VerifierFunction,
} from "./src/type.js";
