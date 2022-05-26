import { reactive } from "@starbeam/core";
import type { Database, DatabaseFor } from "./database.js";
import type { Row } from "./row.js";
import type { TableType } from "./table.js";

type HasManyData<Table extends string> =
  | {
      readonly kind: "monomorphic";
      readonly type: Table;
      readonly ids: Set<string>;
    }
  | {
      readonly kind: "polymorphic";
      readonly rows: Map<Table, Set<string>>;
    };

export class HasMany<T extends TableType> {
  static create<T extends TableType>(
    table: T["name"],
    ids: string[]
  ): HasMany<T> {
    const set: Set<string> = reactive(Set);
    for (const id of ids) {
      set.add(id);
    }
    return new HasMany(table, set);
  }

  #table: T["name"];
  #ids: Set<string>;

  private constructor(table: T["name"], ids: Set<string>) {
    this.#table = table;
    this.#ids = ids;
  }

  add(id: string) {
    this.#ids.add(id);
  }

  get(db: DatabaseFor<T>): Row<T>[] {
    const table = db.get(this.#table);
    return [...this.#ids]
      .map((id) => table.get(id))
      .filter(Boolean) as Row<T>[];
  }
}

export class HasManyPolymorphic<Names extends string> {
  static create<Names extends string>(
    ...rows: { type: Names; id: string }[]
  ): HasManyPolymorphic<Names> {
    const map: Map<Names, Set<string>> = reactive(Map);

    for (const { type, id } of rows) {
      let set = map.get(type);

      if (!set) {
        set = reactive(Set);
        map.set(type, set);
      }

      set.add(id);
    }

    return new HasManyPolymorphic(map);
  }

  #rows: Map<Names, Set<string>>;

  constructor(rows: Map<Names, Set<string>>) {
    this.#rows = rows;
  }

  get<D extends Database<any>>(db: Database<any>): Row<{ name: Names }>[] {
}

export class HasOne<T extends TableType> {
  static create<T extends TableType>(
    table: T["name"],
    id: string
  ): HasOne<TableType> {
    return new HasOne(table, id);
  }

  #table: T["name"];
  #id: string;

  private constructor(table: T["name"], id: string) {
    this.#table = table;
    this.#id = id;
  }

  get(db: DatabaseFor<T>): Row<T> | null {
    const table = db.get(this.#table);
    return table.get(this.#id);
  }
}
