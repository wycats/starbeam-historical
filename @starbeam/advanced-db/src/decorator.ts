import { Row } from "./row.js";
import { ROW, Table, type ModelInstance, type TableType } from "./table.js";

export class Model<T extends TableType = TableType>
  implements ModelInstance<T>
{
  static create<M extends Model<T>, T extends TableType>(
    this: new (row: Row<T>) => M,
    table: Table<M, T>,
    id: string,
    columns: T["columns"]
  ): M {
    return new this(Row.instantiate(table, id, columns));
  }

  readonly [ROW]: Row<T>;

  declare TYPE: T;

  constructor(row: Row<T>) {
    this[ROW] = row;
  }

  get id(): string {
    return this[ROW].id;
  }

  get $draft() {
    return this[ROW].draft;
  }
}

export const attr = <K extends string>(
  target: Model<{ name: string; columns: Record<K, any>; indexes: unknown }>,
  key: K
): void => {
  return {
    enumerable: true,
    configurable: true,
    get(this: Model) {
      return this[ROW].columns[key as any];
    },
  } as any;
};
