import { Stack } from "@starbeam/debug-utils";
import type { InferReturn } from "@starbeam/utils";
import { accessor, data, method, proxy } from "./proxy.js";
import type { Reference } from "./reference.js";
import { Row } from "./row.js";
import { Table, type TableType } from "./table.js";

interface Predicate<T> {
  (value: unknown): value is T;
  check(runtime: (value: unknown) => value is T): Predicate<T>;
}

export function Type<T>(description = Stack.describeCaller()): Predicate<T> {
  let specified: undefined | ((value: unknown) => value is T);
  const predicate = (value: unknown): value is T => {
    if (specified) {
      return specified(value);
    } else {
      return true;
    }
  };

  predicate.check = (runtime: (value: unknown) => value is T): Predicate<T> => {
    specified = runtime;
    return predicate;
  };

  return predicate;
}

export type ReadonlyModel<T extends TableType> = {
  readonly [P in keyof T["columns"]]: T["columns"][P];
};

export type ReadWriteModel<T extends TableType> = {
  [P in keyof T["columns"]]: T["columns"][P];
};

export type ModelDraft<T extends TableType> = {
  readonly id: string;
  $commit(): void;
} & ReadWriteModel<T>;

export type Model<T extends TableType> = {
  readonly id: string;
} & ReadonlyModel<T> & {
    $ref: Reference<T, string>;
    $draft: ModelDraft<T>;
  };

export interface ModelClass<T extends TableType> {
  readonly table: Table<T>;
}

function ModelProxy(table: Table, row: Row): Model<any> {
  const p = proxy(row, {
    properties: {
      $ref: data.readonly((target) => target.reference),
      $draft: accessor.readonly((target) => DraftModel(table, target)),
    },
    index: {
      string: {
        keys: Object.keys(row.columns),
        property: data.readonly(
          (row: Row, key: keyof any) => row.columns[key as keyof Row]
        ),
      },
    },
  });

  return p as InferReturn;
}

export function Model(): abstract new <T extends TableType>(
  id: string,
  columns: T["columns"]
) => Model<T> {
  const tables = new Map<string, Table<any>>();

  class Model<T extends TableType> {
    constructor(id: string, columns: T["columns"]) {
      const name = new.target.name;
      let table = tables.get(name);

      if (!table) {
        table = Table.define().named(name);
        tables.set(name, table);
      }

      const row = Row.instantiate(table, id, columns);

      return Reflect.construct(ModelProxy, [table, row], new.target);
    }
  }

  return Model as InferReturn;
}

function DraftModel<T extends TableType>(
  table: Table<T>,
  row: Row<T>
): ModelDraft<T> {
  const draft = row.draft;

  const p = proxy(draft, {
    properties: {
      id: data.readonly((target) => target.id),
      $commit: method((target) => target.commit()),
    },
    index: {
      string: {
        keys: Object.keys(row.columns),
        property: data.mutable({
          get: (target, key) => target.columns[key as keyof Row],
          set: (target, value, key) => {
            target.mutate[key as keyof T["columns"]] = value;
          },
        }),
      },
    },
  });

  return p as InferReturn;
}
