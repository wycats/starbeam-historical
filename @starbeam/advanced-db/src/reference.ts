import type { Row } from "./row.js";
import { ROW, type Table, type TableType } from "./table.js";

export class Reference<T extends TableType, Id extends string = string> {
  static create<T extends TableType, Id extends string>(
    table: Table<any, T>,
    id: Id
  ): Reference<T, Id> {
    return new Reference(table, id);
  }

  readonly #table: Table<any, T>;
  readonly #id: Id;

  private constructor(table: Table<any, T>, id: Id) {
    this.#table = table;
    this.#id = id;
  }

  equals(other: Reference<T> | Row<T>): boolean {
    if (other instanceof Reference) {
      return this.#table === other.#table && this.#id === other.#id;
    } else {
      return this.equals(other.reference);
    }
  }

  get row(): Row<T> | null {
    return this.#table.get(this.#id)?.[ROW] ?? null;
  }
}
