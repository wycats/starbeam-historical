import { reactive, UNINITIALIZED } from "@starbeam/core";
import { debug } from "@starbeam/debug";
import { Cell, FormulaState } from "@starbeam/reactive";
import type { Row } from "./row.js";
import type { TableType } from "./table.js";

class IndexEntry<T> {
  static create<T>(
    map: InternalReactiveMap<T>,
    row: Row,
    indexer: (row: Row) => T,
    description: string
  ) {
    return new IndexEntry(
      map,
      row,
      UNINITIALIZED,
      FormulaState.evaluate(() => indexer(row), "index entry").state,
      description
    );
  }

  static {
    debug(this, "IndexEntry").inspector((entry, debug) =>
      debug.struct(
        {
          entries: entry.#map,
        },
        {
          description: `${entry.#description} for ${entry.#row.id}`,
        }
      )
    );
  }

  readonly #map: InternalReactiveMap<T>;
  readonly #row: Row;
  #cache: Cell<T> | UNINITIALIZED;
  readonly #formula: FormulaState<T>;
  readonly #description: string;

  private constructor(
    map: InternalReactiveMap<T>,
    row: Row,
    cache: Cell<T> | UNINITIALIZED,
    formula: FormulaState<T>,
    description: string
  ) {
    this.#map = map;
    this.#row = row;
    this.#cache = cache;
    this.#formula = formula;
    this.#description = description;
  }

  update(updater: (newValue: T) => void): void {
    this.#update(updater);
  }

  /**
   * Call the updater callback with a new value if the value has changed.
   */
  #update(updater?: (newValue: T) => void): Cell<T> {
    const status = this.#formula.poll();

    if (this.#cache === UNINITIALIZED) {
      this.#cache = Cell(status.value);
      updater?.(status.value);
    } else {
      const oldValue = this.#cache.current;

      if (oldValue !== status.value) {
        this.#cache.set(status.value);
        updater?.(status.value);
      }
    }

    return this.#cache;
  }
}

type InternalReactiveMap<Value> = Map<
  /** the keys are row IDs */
  string,
  IndexEntry<Value>
>;

export class ReactiveIndexMap<Value> {
  static create<Table extends TableType, Value>(description: string) {
    return new ReactiveIndexMap(reactive.Map(), new Map(), description);
  }

  /**
   * The source of truth for the index.
   */
  readonly #entries: InternalReactiveMap<Value>;

  /**
   * A cache of the index's values. The cache is not always up to date, and is
   * lazily updated when the index is accessed.
   *
   * Note: This sort of internal cache violates the rule against mutation during
   * reactive computation. This is, in principle, fine, because it's a
   * purely-internal cache that cannot be accessed by the outside world.
   * However, we want it to be an error to write to reactive state during the
   * render phase, so we need to mark this sort of internal cache so that it
   * doesn't trip the error.
   *
   * Even better: finding a way to expose this pattern as a primitive. That
   * requires some thought, but is almost certainly the way to go.
   */
  readonly #cache: Map<string, Value>;
  readonly #description: string;

  private constructor(
    entries: InternalReactiveMap<Value>,
    cache: Map<string, Value>,
    description: string
  ) {
    this.#entries = entries;
    this.#cache = cache;
    this.#description = description;
  }

  has(id: string): boolean {
    return this.#entries.has(id);
  }

  get(id: string): Value | undefined {
    this.#updateId(id);
    return this.#cache.get(id);
  }

  add(row: Row, indexer: (row: Row) => Value) {
    this.#entries.set(
      row.id,
      IndexEntry.create(
        this.#entries,
        row,
        indexer as (row: Row) => Value,
        this.#description
      )
    );
  }

  delete(id: string) {
    this.#entries.delete(id);
  }

  equaling(pattern: Value): string[] {
    this.#update();
    const matches = [];

    for (const [id, value] of this.#cache) {
      if (pattern === value) {
        matches.push(id);
      }
    }

    return matches;
  }

  #updateId(id: string): void {
    const entry = this.#entries.get(id);

    if (entry === undefined) {
      console.warn(
        `You tried to access a row (${id}) through index ${
          this.#description
        }, but that row was not in the index.`
      );
    }

    entry?.update((newValue) => {
      this.#cache.set(id, newValue);
    });
  }

  #update() {
    for (const [id, entry] of this.#entries.entries()) {
      entry.update((newValue) => {
        this.#cache.set(id, newValue);
      });
    }
  }
}

/**
 * An Index is a reactive map from a row to a formula. This makes it possible to implement an arbitrary index on a table using any computation you want.
 */
export class Index<Table extends TableType, Value> {
  static create<Table extends TableType, T>(
    indexer: (row: Row<Table>) => T,
    description: string
  ): Index<Table, T> {
    return new Index(
      indexer,
      ReactiveIndexMap.create(description),
      description
    );
  }

  static {
    debug(this, "Index").inspector((index, debug) =>
      debug.struct(
        {
          map: index.#map,
          indexer: index.#indexer,
        },
        {
          description: index.#description,
        }
      )
    );
  }

  /**
   * The indexer function goes from a row to a value. It gets wrapped in a formula so that changes to the contents of the row cause it to be automatically re-indexed.
   */
  readonly #indexer: (row: Row<Table>) => Value;
  /**
   * A Map from rows to values. This map is proactively updated when the rows are modified.
   */
  readonly #map: ReactiveIndexMap<Value>;

  readonly #description: string;

  constructor(
    indexer: (row: Row<Table>) => Value,
    map: ReactiveIndexMap<Value>,
    description: string
  ) {
    this.#indexer = indexer;
    this.#map = map;
    this.#description = description;
  }

  /**
   * Add a new row to the index.
   */
  add(row: Row<Table>): void {
    this.#map.add(row, this.#indexer as (row: Row) => Value);
  }

  delete(id: string): void {
    this.#map.delete(id);
  }

  /**
   * Check whether a row is in the index with a particular value.
   */
  has(id: string, value: Value): boolean {
    return this.#map.has(id);
  }

  get(id: string): Value | undefined {
    return this.#map.get(id);
  }

  /**
   * Get the IDs of all of the rows in the index with a particular value.
   */
  equaling(value: Value): string[] {
    return this.#map.equaling(value);
  }
}

export type IndexRecord<Table extends TableType> = {
  [P in keyof any]: Index<Table, unknown>;
};

export class Indexes<Table extends TableType> {
  static create<Table extends TableType>(): Indexes<Table> {
    return new Indexes({} as IndexRecord<TableType>);
  }

  readonly #indexes: IndexRecord<Table>;

  constructor(indexes: IndexRecord<Table>) {
    this.#indexes = indexes;
  }

  add(
    name: string,
    indexer: (row: Row<Table>) => any,
    description: string
  ): void {
    const index = Index.create(indexer, description);
    this.#indexes[name] = index;
  }

  insert(row: Row<Table>): void {
    for (const index of Object.values(this.#indexes)) {
      index.add(row);
    }
  }

  delete(row: Row<Table>): void {
    for (const index of Object.values(this.#indexes)) {
      index.delete(row.id);
    }
  }

  get<T>(name: string): Index<Table, T> {
    return this.#indexes[name] as Index<Table, T>;
  }
}
