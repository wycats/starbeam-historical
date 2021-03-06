import { DisplayStruct } from "@starbeam/debug";
import { UNINITIALIZED } from "@starbeam/fundamental";
import { Linkable, Reactive } from "@starbeam/reactive";
import {
  LIFETIME,
  REACTIVE,
  TIMELINE,
  type MutableInternals,
} from "@starbeam/timeline";
import { Abstraction, LOGGER } from "@starbeam/trace-internals";
import { Enum } from "@starbeam/utils";
import { INSPECT } from "../utils.js";

const logger = LOGGER.scoped("@starbeam/core/glue/sync");

export class PollResult<T> extends Enum(
  "InitialValue(T)",
  "UnchangedValue(T)",
  "ChangedValue(U)"
)<T, { value: T; last: T }> {
  get value(): T {
    return this.match({
      InitialValue: (value) => value,
      UnchangedValue: (value) => value,
      ChangedValue: ({ value }) => value,
    });
  }

  [INSPECT]() {
    const name = this.match({
      InitialValue: () => "Initial",
      ChangedValue: () => "Changed",
      UnchangedValue: () => "Unchanged",
    });

    return DisplayStruct(name, { value: this.value });
  }
}

export interface ReactiveSubscription<T = unknown> {
  poll: () => PollResult<T>;
  unsubscribe: () => void;
}

function initialize<S extends ReactiveSubscription>(
  subscription: S
): Linkable<S> {
  return Linkable.create((owner) => {
    LIFETIME.on.finalize(subscription, () => subscription.unsubscribe());
    LIFETIME.link(owner, subscription);
    subscription.poll();
    return subscription;
  });
}

/**
 * [markdown]
 *
 * This API allows external consumers of Starbeam Reactive values to subscribe
 * (and unsubscribe) to a signal that a change in the underlying value is ready.
 *
 * It does *not* recompute the value, which has several benefits:
 *
 * - If a change was ready multiple times before a consumer had a chance to ask
 *   for the value of a reactive computation, the computation will only occur
 *   once.
 * - If a change was ready, but its consumer never needs the value, the reactive
 *   computation will never occur.
 *
 * The change readiness notification occurs synchronously and is not batched. It
 * is not intended to trigger synchronous re-renders, but rather to inform the
 * consumer that a scheduled revalidation is needed.
 *
 * The `subscribe` function returns an `ExternalSubscription`, which provides:
 *
 * - a `poll()` method that the consumer can call once it receives the change
 *   readiness notification. The `poll()` method returns a status (`initial` or
 *   `changed` or `unchanged`) as well as the current value.
 * - an `unsubscribe()` method that the consumer should call when it is no
 *   longer interested in receiving notifications. Once this method is called,
 *   no further notifications will occur.
 */
export function subscribe<T>(
  reactive: Reactive<T>,
  ready: (subscription: ReactiveSubscription<T>) => void,
  description = `subscriber (to ${
    reactive[REACTIVE]
  }) <- ${Abstraction.callerFrame()}`
): Linkable<ReactiveSubscription<T>> {
  const dependencies = reactive[REACTIVE].children().dependencies;

  if (Array.isArray(dependencies) && dependencies.length === 0) {
    return initialize(ConstantSubscription.create(reactive.current));
  } else {
    return initialize(
      AnyReactiveSubscription.create(reactive, ready, description)
    );
  }
}

// hello world
class ConstantSubscription<T> implements ReactiveSubscription<T> {
  static create<T>(value: T): ConstantSubscription<T> {
    return new ConstantSubscription(value);
  }

  readonly #value: T;

  private constructor(value: T) {
    this.#value = value;
  }

  poll = (): PollResult<T> => PollResult.UnchangedValue(this.#value);
  unsubscribe = () => {
    /* noop */
  };
}

class AnyReactiveSubscription<T> implements ReactiveSubscription<T> {
  static create<T>(
    reactive: Reactive<T>,
    ready: (subscription: ReactiveSubscription<T>) => void,
    description: string
  ): AnyReactiveSubscription<T> {
    const teardown = new Map();

    const subscription = new AnyReactiveSubscription(
      UNINITIALIZED,
      reactive,
      teardown,
      (): void => ready(subscription),
      description
    );

    return subscription;
  }

  #last: T | UNINITIALIZED;
  readonly #reactive: Reactive<T>;
  readonly #storages: Map<MutableInternals, () => void>;
  readonly #notify: () => void;
  readonly #description: string;

  private constructor(
    last: T | UNINITIALIZED,
    reactive: Reactive<T>,
    storages: Map<MutableInternals, () => void>,
    notify: () => void,
    description: string
  ) {
    this.#last = last;
    this.#reactive = reactive;
    this.#storages = storages;
    this.#notify = notify;
    this.#description = description;
  }

  [INSPECT]() {
    return DisplayStruct(`Subscription (${this.#description})`, {
      last: this.#last,
      reactive: this.#reactive,
      cells: [...this.#storages.keys()],
    });
  }

  poll = (): PollResult<T> => {
    const last = this.#last;
    const newValue = this.#reactive.current;
    const newDeps = Reactive.getDependencies(this.#reactive);

    this.#synchronize(new Set(newDeps));

    if (last === UNINITIALIZED) {
      this.#last = newValue;
      return PollResult.InitialValue(newValue);
    } else if (last === newValue) {
      return PollResult.UnchangedValue(newValue);
    } else {
      this.#last = newValue;
      return PollResult.ChangedValue({ value: newValue, last });
    }
  };

  unsubscribe = () => {
    for (let teardown of this.#storages.values()) {
      teardown();
    }
  };

  #synchronize(newCells: Set<MutableInternals>): void {
    for (const [cell, teardown] of this.#storages) {
      if (!newCells.has(cell)) {
        logger.trace.log(
          `tearing down (${this.#description}) cell`,
          cell,
          this.#notify
        );
        teardown();
        this.#storages.delete(cell);
      }
    }

    for (const cell of newCells) {
      if (!this.#storages.has(cell)) {
        LOGGER.trace.log(
          `setting up (${this.#description}) cell`,
          cell,
          this.#notify
        );

        let teardown = TIMELINE.on.update(cell, this.#notify);
        this.#storages.set(cell, teardown);
      }
    }
  }
}
