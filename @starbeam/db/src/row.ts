import { reactive } from "@starbeam/core";
import { HasOne } from "./reference.js";
import type { TableType } from "./table.js";

export class Row<T extends TableType> {
  static create<T extends TableType>(
    table: T["name"],
    id: string,
    columns: T["columns"]
  ): Row<T> {
    return new Row(table, id, reactive(columns));
  }

  readonly #table: T["name"];
  readonly #id: string;
  readonly #columns: T["columns"];

  private constructor(table: T["name"], id: string, columns: T["columns"]) {
    this.#table = table;
    this.#id = id;
    this.#columns = columns;
  }

  get id(): string {
    return this.#id;
  }

  get fk(): HasOne<T> {
    return HasOne.create(this.#table, this.#id);
  }

  get columns(): Readonly<T["columns"]> {
    return this.#columns;
  }

  get mutate(): T["columns"] {
    return this.#columns;
  }
}
