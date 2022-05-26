import type { InferReturn } from "@starbeam/fundamental";
import { Cell, Formula } from "@starbeam/reactive";
import { expected, verify } from "@starbeam/verify";
import {
  builtin,
  type BuiltinDescription,
} from "../reactive/builtins/builtin.js";
import { TrackedMap } from "../reactive/builtins/map.js";
import { is } from "../strippable/minimal.js";

type BuiltinFunction = typeof builtin;

interface ReactiveDecorator {
  (target: object, key: symbol | string): void;
}

interface ReactiveStatics {
  Map<K, V>(): Map<K, V>;
}

interface ReactiveFunction
  extends ReactiveDecorator,
    BuiltinFunction,
    ReactiveStatics {}

export const reactive: ReactiveFunction = (
  target: unknown,
  key?: symbol | string | BuiltinDescription,
  descriptor?: object
): InferReturn => {
  if (descriptor === undefined) {
    return builtin(
      target as Parameters<BuiltinFunction>[0],
      key as Parameters<BuiltinFunction>[1]
    );
  }

  const cell = Cell<unknown>(undefined, `@reactive ${String(key)}`);

  return {
    enumerable: true,
    configurable: true,
    get: function () {
      return cell.current;
    },
    set: function (value: unknown) {
      cell.current = value;
    },
  };
};

reactive.Map = <K, V>(): Map<K, V> => {
  return new TrackedMap();
};

export const cached = <T>(
  _target: object,
  key: symbol | string,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> => {
  const { get, enumerable, configurable } = descriptor;

  verify(
    get,
    is.Present,
    expected(`the target of @cached`)
      .toBe(`a getter`)
      .butGot(() =>
        typeof descriptor.value === "function" ? `a method` : `a field`
      )
  );

  const CACHED = new WeakMap();

  return {
    enumerable: true,
    configurable: true,

    get: function () {
      let formula = CACHED.get(this);

      if (!formula) {
        formula = Formula(() => get.call(this), `computing ${String(key)}`);
        CACHED.set(this, formula);
      }

      return formula.current;
    },
  };
};
