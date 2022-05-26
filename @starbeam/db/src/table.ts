import { reactive } from "@starbeam/core";
import { Row } from "./row.js";

export interface TableType {
  readonly name: string;
  readonly columns: Record<string, any>;
}

export type RowType<N extends string, C extends Record<string, any>> = {
  readonly name: N;
  readonly columns: C;
};

export type TableClass<T extends Table> = {
  create(): T;
};

export type Table<T extends TableType = TableType> = AbstractTable<T>;

export interface CustomTable<N extends string> {
  create<This extends new (...args: any[]) => any>(
    this: This
  ): InstanceType<This>;
  new <C extends Record<string, any>>(): Table<RowType<N, C>>;
}

export function Table<N extends string>(name: N): CustomTable<N> {
  class Table<C extends Record<string, any>> extends AbstractTable<{
    name: N;
    columns: C;
  }> {
    static create<This extends abstract new (...args: any[]) => any>(
      this: This
    ): InstanceType<This> {
      return new Table(name, reactive(Map)) as InstanceType<This>;
    }
  }

  Object.defineProperty(Table, "name", {
    enumerable: true,
    configurable: true,
    writable: false,
    value: name,
  });

  return Table as CustomTable<N>;
}

export abstract class AbstractTable<T extends TableType>
  implements Iterable<Readonly<T["columns"]>>
{
  static create<This extends new (name: string, rows: Map<string, any>) => any>(
    this: This,
    name: string
  ): InstanceType<This> {
    return new this(name, reactive(Map));
  }

  readonly #name: T["name"];
  readonly #rows: Map<string, Row<T>>;

  constructor(name: T["name"], rows: Map<string, Row<T>>) {
    this.#name = name;
    this.#rows = rows;
  }

  get name(): T["name"] {
    return this.#name;
  }

  *[Symbol.iterator](): IterableIterator<Readonly<T["columns"]>> {
    for (const row of this.#rows.values()) {
      yield row.columns;
    }
  }

  create(id: string, columns: T["columns"]): Row<T> {
    const row = Row.create(this.#name, id, columns);
    this.#rows.set(id, row);
    return row;
  }

  has(id: string): boolean {
    return this.#rows.has(id);
  }

  get(id: string): Row<T> | null {
    return this.#rows.get(id) ?? null;
  }

  delete(row: string | Row<T>): void {
    if (typeof row === "string") {
      this.#rows.delete(row);
    } else {
      this.#rows.delete(row.id);
    }
  }

  rows(): IterableIterator<Row<T>> {
    return this.#rows.values();
  }
}
