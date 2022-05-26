import type { InferReturn } from "@starbeam/utils";

interface ReadonlyDataProperty<T> {
  readonly enumerable: true;
  readonly configurable: true;
  readonly writable: false;
  readonly value: T;
}

abstract class Definition<Target, T> {
  abstract readonly enumerable: boolean;

  constructor(
    readonly type: "data" | "accessor",
    readonly accessors:
      | {
          readonly type: "readonly";
          readonly get: (target: Target, key: PropertyKey) => T;
        }
      | {
          readonly type: "mutable";
          readonly get: (target: Target, key: PropertyKey) => T;
          readonly set: (target: Target, value: T, key: PropertyKey) => void;
        },
    readonly property: PropertyKey
  ) {}

  get(target: Target): T {
    return this.accessors.get(target, this.property);
  }

  /**
   * Returns true if the property is mutable, and false if the property is immutable.
   *
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set
   */
  set(target: Target, value: T): boolean {
    if (this.accessors.type === "mutable") {
      this.accessors.set(target, value, this.property);
      return true;
    } else {
      return false;
    }
  }

  /**
   * A snapshot of the descriptor to use. This should not be cached.
   */
  descriptor(target: Target): PropertyDescriptor {
    const accessors = this.accessors;
    switch (this.type) {
      case "data":
        return {
          enumerable: this.enumerable,
          configurable: true,
          writable: accessors.type === "mutable",
          value: this.get(target),
        };
      case "accessor": {
        return {
          enumerable: this.enumerable,
          configurable: true,
          get: () => this.accessors.get(target, this.property),
          set:
            accessors.type === "mutable"
              ? (value: T) => accessors.set(target, value, this.property)
              : undefined,
        };
      }
    }
  }
}

export class Method<Target, Args extends unknown[], T> extends Definition<
  Target,
  (...args: Args) => T
> {
  readonly enumerable = true;

  constructor(
    readonly property: PropertyKey,
    method: (target: Target, ...args: Args) => T
  ) {
    super(
      "data",
      {
        type: "readonly",
        get: (target, key) => {
          return (...args: Args) => method(target, ...args);
        },
      },
      property
    );
  }
}

export function method<Target, Args extends unknown[], T>(
  method: (target: Target, ...args: Args) => T
): (property: PropertyKey) => Method<Target, Args, T> {
  return (property) => new Method(property, method);
}

export class ReadonlyDataDefinition<Target, T> extends Definition<Target, T> {
  readonly enumerable = true;

  constructor(
    readonly property: PropertyKey,
    get: (target: Target, key: PropertyKey) => T
  ) {
    super("data", { type: "readonly", get }, property);
  }
}

export class MutableDataDefinition<Target, T> extends Definition<Target, T> {
  readonly enumerable = true;

  constructor(
    readonly property: PropertyKey,
    get: (target: Target, key: PropertyKey) => T,
    set: (target: Target, value: T, key: PropertyKey) => void
  ) {
    super("data", { type: "mutable", get, set }, property);
  }
}

export class ReadonlyAccessorDefinition<Target, T> extends Definition<
  Target,
  T
> {
  readonly enumerable = false;

  constructor(readonly property: PropertyKey, get: (target: Target) => T) {
    super("accessor", { type: "readonly", get }, property);
  }
}

export class MutableAccessorDefinition<Target, T> extends Definition<
  Target,
  T
> {
  readonly enumerable = false;

  constructor(
    readonly property: PropertyKey,
    get: (target: Target) => T,
    set: (target: Target, value: T) => void
  ) {
    super("accessor", { type: "mutable", get, set }, property);
  }
}

export const data = {
  readonly<Target, T>(
    get: (target: Target, key: PropertyKey) => T
  ): (property: PropertyKey) => ReadonlyDataDefinition<Target, T> {
    return (property: PropertyKey) => new ReadonlyDataDefinition(property, get);
  },

  mutable<Target, T>({
    get,
    set,
  }: {
    get: (target: Target, key: PropertyKey) => T;
    set: (target: Target, value: T, key: PropertyKey) => void;
  }): (property: PropertyKey) => MutableDataDefinition<Target, T> {
    return (property) => new MutableDataDefinition(property, get, set);
  },
};

export const accessor = {
  readonly<Target, T>(
    get: (target: Target) => T
  ): (property: PropertyKey) => ReadonlyAccessorDefinition<Target, T> {
    return (property) => new ReadonlyAccessorDefinition(property, get);
  },

  mutable<Target, T>({
    get,
    set,
  }: {
    get: (target: Target) => T;
    set: (target: Target, value: T) => void;
  }): (property: PropertyKey) => MutableAccessorDefinition<Target, T> {
    return (property) => new MutableAccessorDefinition(property, get, set);
  },
};

export interface ReadonlyAccessor<T> {
  readonly enumerable: boolean;
  readonly configurable: true;
  readonly get: () => T;
}

type ProxyPropertyDefinition<Target, T> =
  | ReadonlyDataDefinition<Target, T>
  | MutableDataDefinition<Target, T>
  | Method<Target, any, T>
  | ReadonlyAccessorDefinition<Target, T>
  | MutableAccessorDefinition<Target, T>;

type ValueForDefinition<
  Target,
  Key extends PropertyKey,
  D extends
    | "passthrough"
    | ((property: PropertyKey) => ProxyPropertyDefinition<any, any>)
> = D extends (property: PropertyKey) => ProxyPropertyDefinition<any, infer T>
  ? T
  : D extends "passthrough"
  ? Key extends keyof Target
    ? Target[Key]
    : never
  : never;

export interface ProxyDefinition<Target> {
  readonly properties: {
    [P in keyof any]: (
      property: PropertyKey
    ) => ProxyPropertyDefinition<Target, any>;
  };
  readonly index?: {
    string?: {
      keys: string[];
      property: (property: string) => ProxyPropertyDefinition<Target, any>;
    };
    symbol?:
      | {
          keys: symbol[];
          property: (property: symbol) => ProxyPropertyDefinition<Target, any>;
        }
      | "passthrough";
  };
  readonly prototype?: object | null;
}

type PropertiesForCatchAll<
  Target,
  D extends
    | {
        keys: any[];
        property: (property: PropertyKey) => ProxyPropertyDefinition<any, any>;
      }
    | undefined
> = D extends {
  keys: any[];
  property:
    | "passthrough"
    | ((property: PropertyKey) => ProxyPropertyDefinition<any, any>);
}
  ? {
      [P in D["keys"][number]]: ValueForDefinition<Target, P, D["property"]>;
    }
  : {};

type PropertiesForIndex<
  Target,
  D extends ProxyDefinition<any>["index"]
> = D extends {
  string: { keys: string[]; property: ProxyPropertyDefinition<any, any> };
  symbol: { keys: symbol[]; property: ProxyPropertyDefinition<any, any> };
}
  ? PropertiesForCatchAll<Target, D["string"]> &
      PropertiesForCatchAll<Target, D["symbol"]>
  : {};

type ProxyFor<Target, D extends ProxyDefinition<any>> = {
  [P in keyof D["properties"]]: ValueForDefinition<
    Target,
    P,
    D["properties"][P]
  >;
} & (D extends {
  index: {
    string: { keys: string[]; property: ProxyPropertyDefinition<any, any> };
    symbol: { keys: symbol[]; property: ProxyPropertyDefinition<any, any> };
  };
}
  ? PropertiesForIndex<Target, D["index"]>
  : {});

/**
 * `proxy` creates a proxy for a target with a specified definition.
 *
 * The proxy is:
 *
 * - sealed: it does not support defineProperty or deleteProperty.
 * - not frozen:  it has configurable properties and doesn't support freezing.
 */
export function proxy<Target extends object, D extends ProxyDefinition<Target>>(
  target: Target,
  definition: D
): ProxyFor<Target, D> {
  const { properties, index } = definition;

  const proxy = new Proxy(target, {
    defineProperty: () => {
      return false;
    },

    deleteProperty: () => {
      return false;
    },

    getPrototypeOf: () => {
      return definition.prototype ?? null;
    },

    setPrototypeOf: () => {
      return false;
    },

    getOwnPropertyDescriptor: (target, property) => {
      const propertyDefinition = properties[property as any];
      if (propertyDefinition) {
        return propertyDefinition(property).descriptor(target);
      }

      if (index) {
        switch (typeof property) {
          case "string": {
            if (index.string?.keys.includes(property)) {
              return index.string.property(property).descriptor(target);
            }
            break;
          }
          case "symbol": {
            if (index?.symbol) {
              if (index.symbol === "passthrough") {
                return Reflect.getOwnPropertyDescriptor(target, property);
              } else {
                return index.symbol.property(property).descriptor(target);
              }
            }
          }
        }
      }

      return undefined;
    },

    ownKeys: () => {
      const keys: (string | symbol)[] = Object.getOwnPropertyNames(properties);
      if (index) {
        if (index.string) {
          keys.push(...index.string.keys);
        }
        if (index.symbol) {
          if (index.symbol === "passthrough") {
            keys.push(...Object.getOwnPropertySymbols(target));
          } else {
            keys.push(...index.symbol.keys);
          }
        }
      }
      return keys;
    },

    has: (_, property) => {
      if (property in properties) {
        return true;
      }

      if (typeof property === "string" && index?.string) {
        return index.string.keys.includes(property);
      }

      if (typeof property === "symbol" && index?.symbol) {
        if (index.symbol === "passthrough") {
          return Reflect.has(target, property);
        } else {
          return index.symbol.keys.includes(property);
        }
      }

      return false;
    },

    get: (target, property) => {
      if (property in properties) {
        return properties[property as keyof D["properties"]](property).get(
          target
        );
      }

      switch (typeof property) {
        case "string": {
          if (index?.string) {
            return (
              index.string.property(property) as ProxyPropertyDefinition<
                Target,
                any
              >
            ).get(target);
          }
          break;
        }

        case "symbol": {
          if (index?.symbol) {
            if (index.symbol === "passthrough") {
              return Reflect.get(target, property);
            } else {
              return (
                index.symbol.property(property) as ProxyPropertyDefinition<
                  Target,
                  any
                >
              ).get(target);
            }
          }

          break;
        }
      }

      return;
    },

    set: (target, property, value) => {
      if (property in properties) {
        return properties[property as keyof D["properties"]](property).set(
          target,
          value
        );
      }

      switch (typeof property) {
        case "string": {
          if (index?.string) {
            return (
              index.string.property(property) as ProxyPropertyDefinition<
                Target,
                any
              >
            ).set(target, value);
          }
          break;
        }
        case "symbol": {
          if (index?.symbol) {
            if (index.symbol === "passthrough") {
              return Reflect.set(target, property, value);
            } else {
              return (
                index.symbol.property(property) as ProxyPropertyDefinition<
                  Target,
                  any
                >
              ).set(target, value);
            }
          }
        }
      }

      return false;
    },
  });

  return proxy as InferReturn;
}
