import { reactive } from "@starbeam/core";
import type { AnyRecord } from "@starbeam/fundamental";
import { Marker } from "@starbeam/reactive";
import type { InferReturn } from "@starbeam/utils";
import { as, isPresent, verified } from "@starbeam/verify";
import { Index, Indexes } from "./db-index.js";
import type { Model } from "./decorator.js";
import { Reference } from "./reference.js";
import { DraftForNew, Row } from "./row.js";

export type IndexesType<T extends TableType> = {
  [P in keyof any]: Index<T, unknown>;
};

export interface TableType {
  readonly name: string;
  readonly columns: AnyRecord;
  readonly indexes: unknown;
}

export interface RowType<N extends string, C extends AnyRecord>
  extends TableType {
  readonly name: N;
  readonly columns: C;
  readonly indexes: any;
}

export const ROW = Symbol("Row");

export interface ModelInstance<T extends TableType> {
  readonly [ROW]: Row<T>;
}

export class Table<M extends ModelInstance<T>, T extends TableType = TableType>
  implements Iterable<M>
{
  static model<T extends TableType, M extends Model<T>>(
    model: new (row: Row<T>) => M
  ): Table<M, T> {
    const name = model.name;
    return new Table(
      name,
      Marker(`${name} table`),
      (row: Row<T>) => new model(row),
      reactive(Map),
      Indexes.create()
    );
  }

  static define<C extends AnyRecord>(): {
    named<N extends string>(
      name: N
    ): Table<
      Row<{ name: N; columns: C; indexes: {} }>,
      { name: N; columns: C; indexes: {} }
    >;
  } {
    return {
      named<N extends string>(name: N) {
        type Type = { name: N; columns: C; indexes: {} };

        return new Table(
          name,
          Marker(`${name} table`),
          (row: Row<Type>) => row,
          reactive(Map),
          Indexes.create()
        );
      },
    };
  }

  [Symbol.toStringTag]: string = "Table";

  readonly #name: T["name"];
  readonly #marker: Marker;
  readonly #instantiate: (row: Row<T>) => M;
  readonly #rows: Map<string, M>;
  readonly #indexes: Indexes<T>;

  private constructor(
    name: T["name"],
    marker: Marker,
    instantiate: (row: Row<T>) => M,
    rows: Map<string, M>,
    indexes: Indexes<T>
  ) {
    this.#name = name;
    this.#marker = marker;
    this.#instantiate = instantiate;
    this.#rows = rows;
    this.#indexes = indexes;
  }

  get name(): T["name"] {
    return this.#name;
  }

  readonly define = {
    index: <N extends string, U>(
      name: N,
      indexer: (row: Row<T>) => U
    ): Table<
      M,
      {
        readonly name: T["name"];
        readonly columns: T["columns"];
        readonly indexes: T["indexes"] & { [P in N]: U };
      }
    > => {
      this.#indexes.add(name, indexer, `${name} for ${this.#name}`);
      return this as InferReturn;
    },
  };

  reference<Id extends string>(id: Id): Reference<T, Id> {
    return Reference.create(this, id);
  }

  get(id: string): M | null {
    return this.#rows.get(id) ?? null;
  }

  create<Id extends string>(id: Id, columns: T["columns"]): M {
    const row = Row.instantiate(this, id, columns);
    const model = this.#instantiate(row);
    return this.insert(model);
  }

  /**
   * Query by any number of named indexes.
   *
   * At the moment, you can only query by equality, but this will be expanded in
   * the future to other comparisons that can be supported by the index.
   */
  queryBy(query: {
    [P in keyof T["indexes"]]?: T["indexes"][P];
  }): readonly M[] {
    return [...this.#queryByIterator(query)];
  }

  *#queryByIterator(query: {
    [P in keyof T["indexes"]]?: T["indexes"][P];
  }): Iterable<M> {
    const indexes = Object.entries(query);
    const [firstIndexName, firstIndexValue] = verified(
      indexes.shift(),
      isPresent,
      as("a query key").when("calling queryBy")
    );
    const firstIndex = this.#getIndex(firstIndexName);

    const ids = firstIndex.equaling(firstIndexValue);

    for (const id of ids) {
      verifyRow: {
        for (const [indexName, indexValue] of indexes) {
          if (!this.#getIndex(indexName).has(id, indexValue)) {
            break verifyRow;
          }
        }

        const row = this.get(id);

        if (row) {
          yield row;
        } else {
          console.warn(
            `The id ${id} is in the index, but not in the table. This is unexpected and might be a bug.`
          );
        }
      }
    }
  }

  #getIndex(key: string): Index<T, unknown> {
    return verified(
      this.#indexes.get(key),
      isPresent,
      as(`an index named ${key}`)
    );
  }

  *query(query: (row: Row<T>) => boolean): Iterable<M> {
    for (const model of this) {
      if (query(model[ROW])) {
        yield model;
      }
    }
  }

  new<Id extends string>(
    build: (draft: DraftForNew<T, null>) => Row<T, Id>
  ): Row<T, Id> {
    const draft = DraftForNew.create(this, null);
    const row = build(draft);
    this.insert(row);
    return row;
  }

  draft(): DraftForNew<T, null>;
  draft<Id extends string>(id: Id): DraftForNew<T, Id>;
  draft(id: string | null = null): DraftForNew<T, string | null> {
    return DraftForNew.create(this, id);
  }

  /**
   * Insert a new row into this table.
   */
  insert(model: M): M {
    this.#rows.set(model[ROW].id, model);
    // update the table's marker, so that the iterator will yield the new row
    // the next time it is iterated
    this.#marker.update();
    this.#indexes.insert(model[ROW]);

    return model;
  }

  /**
   * Delete a row from this table based on its ID. You can also pass a row
   * instance, in which case the ID of the row will be used.
   */
  delete(id: string): void;
  delete(row: Row<T>): void;
  delete(row: string | Row<T>): void {
    if (typeof row === "string") {
      this.#rows.delete(row);
    } else {
      this.#rows.delete(row.id);
    }
  }

  has(id: string): boolean {
    return this.#rows.has(id);
  }

  /*
   * Iterate over all rows in this table. The iteration process consumes the
   * marker, which means that the next time a row is inserted, the iteration
   * computation will be invalidated.
   */
  *[Symbol.iterator]() {
    this.#marker.consume();

    for (const row of this.#rows.values()) {
      yield row;
    }
  }
}
