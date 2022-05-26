import type { Table, TableType } from "./table.js";

export type DatabaseFor<T extends TableType> = Database<
  Record<T["name"], Table<T>>
>;

export class Database<Tables extends Record<string, Table>> {
  static create(): Database<{}> {
    return new Database({});
  }

  readonly #tables: Tables;

  constructor(tables: Tables) {
    this.#tables = tables;
  }

  add<T extends Table>(table: T): Database<Tables & { [P in T["name"]]: T }> {
    (this.#tables as any)[table.name] = table;
    return this as any;
  }

  get<K extends keyof Tables>(name: K): Tables[K] {
    return this.#tables[name];
  }
}
