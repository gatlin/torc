/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/**
 * Tools for Orchestrating Reactive Computations
 * @packageDocumentation
 */

/**
 * Represents a computation or ongoing behavior which may be halted at any
 * time with the {@link Activity.finish} method.
 * @category Base
 * @public
 */
interface Activity {
  /**
   * @remarks
   * Intended to be idempotent.
   */
  finish(): void;
}

/**
 * A suspended function closure interface.
 * Intended to be compatible with prior art.
 * @category Base
 * @public
 */
interface Continuation<A, B = void> {
  next(value?: A): B;
}

/**
 * A computation which may asynchronously publish 0-or-more values to a
 * downstream {@link Continuation}.
 * @see {@link Continuation}
 * @typeParam A - the value type published by this Site.
 * @category Base
 * @public
 * @remarks
 * The {@link Activity} interface simply represents computations which may be
 * discarded and may be considered "`void` with extra steps."
 * Thus a Site is nothing more than a syntactic wrapper around a function of
 * type `(A => void) => void`, otherwise known as the type of
 * _continuations for `A`_.
 * In other words a Site is an implementation of continuation passing style.
 * @example
 * ```typescript
 * const numbers: Site<number> = each([1, 2, 3, 4, 5, 6, 7, 8, 9]);
 * const xform = then((n: number) => pure(`squared => ${n * n}`));
 * const reducer = {
 *   count: 0,
 *   next(response: string) {
 *     console.log(++this.count, response);
 *   }
 * };
 * void xform(numbers).subscribe(reducer);
 * ```
 * @example
 * ```shell
 * 1 squared => 1
 * 2 squared => 4
 * 3 squared => 9
 * 4 squared => 16
 * 5 squared => 25
 * 6 squared => 36
 * 7 squared => 49
 * 8 squared => 64
 * 9 squared => 81
 * ```
 */
class Site<A> {
  constructor(
    private _sub: (
      c: Continuation<A, unknown>
    ) => Activity | (() => void) | void
  ) {}

  /**
   * @typeParam B - Type returned by the incoming continuation.
   * @param continuation - This function will be called each time the Site
   * publishes a value.
   */
  public subscribe<B = void>(
    continuation: Continuation<A, B> | ((a: A) => B)
  ): Activity {
    const finish =
      "function" === typeof continuation
        ? this._sub({
          next(v: A): B {
            return continuation(v);
          }
        })
        : this._sub(continuation);
    return !finish
      ? {
        finish() {
          return;
        }
      }
      : "function" === typeof finish
        ? { finish }
        : finish;
  }
}

/**
 * Lifts an arbitrary value of any type into a {@link Site} of that type which
 * will publish immediately exactly one time.
 * @category Site constructor
 * @public
 * @example
 * ```typescript
 * const simpleSite = pure(4);
 * simpleSite.subscribe({
 *   next(n: number) {
 *     console.log(`simpleSite value: ${n}`);
 *   }
 * });
 * ```
 * @example
 * ```shell
 * # prints
 * simpleSite value: 4
 * ```
 */
function pure<A>(value: A): Site<A> {
  return new Site((c) => {
    c.next(value);
  });
}

/**
 * Creates a {@link Site} from an `Iterable` object which publishes each of its
 * values exactly once.
 * @category Site constructor
 * @public
 * @example
 * ```typescript
 * const arraySite = each([1, 2, 3]);
 * arraySite.subscribe({
 *   next(n: number) {
 *     console.log(`received: ${n}`);
 *   }
 * });
 * ```
 * @example
 * ```shell
 * # prints
 * received: 1
 * received: 2
 * received: 3
 *```
 */
function each<A>(it: Iterable<A>): Site<A> {
  return new Site((c) => {
    let cancelled = false;
    void setTimeout(() => {
      for (const value of it) {
        if (cancelled) {
          break;
        }
        else {
          c.next(value);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
    };
  });
}

/**
 * Converts a `Promise` into a {@link Site} which fires once.
 * The {@link Activity} returned by a kept `Promise` will cancel it.
 * @category Site constructor
 * @public
 * @remarks
 * A `Promise` may be thought of as a linear Site; a Site may be thought of as
 * a non-linear `Promise`.
 * @example
 * ```typescript
 * const promiseSite = keep(new Promise((resolve) => {
 *   setTimeout(() => {
 *     resolve("hello from 2 seconds ago");
 *   }, 2000);
 * }));
 * const activity = promiseSite.subscribe({
 *   next(msg: string) {
 *     console.log(msg);
 *   }
 * });
 * ```
 * @example
 * ```shell
 * # prints
 * hello from 2 seconds ago
 * ```
 */
function keep<A>(promise: Promise<A>): Site<A> {
  return new Site((c) => {
    let cancelled = false;
    promise.then((value) => {
      if (!cancelled) {
        c.next(value);
      }
    });
    return () => {
      cancelled = true;
    };
  });
}

/**
 * @param sites - The sites whose results are to b
 * @returns A site which executes multiple sites in parallel and merges their
 * result values.
 * @example
 * ```typescript
 * void par([
 *   pure("A"),
 *   pure("B")
 * ]).subscribe((v: string) => { console.log(v); });
 * ```
 * @example
 * ```shell
 * A
 * B
 * ```
 */
function par<A>(sites: Site<A>[]): Site<A> {
  return new Site((continuation) => {
    const activities: Activity[] = [];
    for (const site of sites) {
      setTimeout(() => {
        const activity = site.subscribe(continuation);
        activities.push(activity);
      }, 0);
    }
    return () => {
      activities.forEach((activity) => void activity.finish());
    };
  });
}

/**
 * Useful for writing programs in (delimited) continuation-passing style.
 * @param fn - A function whose argument is a delimited continuation.
 * @returns A {@link Site}.
 * @category Site constructor
 * @experimental
 * @example
 * ```typescript
 * shift(times2 => {
 *   const six = times2(3);                                 // [1]
 *   return times2(six);
 * }).subscribe({
 *   next(three_then_six: number): number {
 *     console.log(`three_then_six = ${three_then_six}`);
 *     return three_then_six * 2;                           // [2]
 *   }
 * });
 * // Note: The value returned by [2] is returned at [1].
 * ```
 * @example
 * ```shell
 * # prints
 * three_then_six = 3
 * three_then_six = 6
 * ```
 */
function shift<A>(fn: (k: (value: A) => unknown) => void): Site<A> {
  return new Site((continuation) => fn((value: A) => continuation.next(value)));
}

/**
 * A function mapping a {@link Site} from one type to another.
 * @category Base
 * @public
 */
interface Operator<A, B> {
  (s: Site<A>): Site<B>;
}

/**
 * Lifts a simple function `A => B` into an {@link Operator}.
 * @see {@link Operator}
 * @see {@link then}
 * @category Operator
 * @public
 */
function map<A, B>(fn: (value: A, index?: number) => B): Operator<A, B> {
  return (source) =>
    new Site<B>((cont) => {
      let count = 0;
      return source.subscribe({
        next(value: A) {
          return cont.next(fn(value, count++) as B);
        }
      });
    });
}

/**
 * Flattens a {@link Site | Site-of-Sites} into a regular Site.
 * @see {@link Operator}
 * @see {@link then}
 * @category Operator
 * @public
 */
function join<A>(): Operator<Site<A>, A> {
  return (source) =>
    new Site<A>((cont) =>
      source.subscribe({
        next(value: Site<A>) {
          return value.subscribe(cont);
        }
      })
    );
}

/**
 * A useful composition of {@link map} and {@link join}.
 * @see {@link Operator}
 * @category Operator
 * @public
 * @see {@link Site} for an example of `then` in action.
 */
function then<A, B>(fn: (a: A) => Site<B>): Operator<A, B> {
  return (source) => join()(map(fn)(source));
}

/**
 * Filters out values from a {@link Site} which do not satisfy the given
 * predicate.
 * @param fn - The predicate function which will test each upstream value.
 * @see {@link Operator}
 * @category Operator
 * @public
 */
function filter<A>(fn: (value: A, index?: number) => boolean): Operator<A, A> {
  return (source) =>
    new Site<A>((cont) => {
      let count = 0;
      return source.subscribe({
        next(value: A) {
          if (fn(value, count++)) {
            return cont.next(value);
          }
        }
      });
    });
}

/**
 * An {@link Operator} which commutes a {@link Site} to one result value
 * before {@link Activity.finish | finishing}.
 * @returns A new site which publishes one value.
 * @example
 * ```typescript
 * const three: Site<number> = prune()(each([3, 2, 1]));
 * three.subscribe((n: number) => void console.log(`n = ${n}`));
 * ```
 * @example
 * ```shell
 * n = 3
 * ```
 */
function prune<A>(): Operator<A, A> {
  return (source) =>
    new Site((continuation) => {
      const activity = source.subscribe({
        next(value: A) {
          activity.finish();
          return continuation.next(value);
        }
      });
      return activity;
    });
}

/**
 * A {@link Site} which relays a value to 0 or more subscribing
 * {@link Continuation | continuations}.
 *
 * You may stop the wire from executing by calling {@link Wire.finish}.
 * The {@link Activity} returned by {@link Wire.subscribe | subscribing} to it
 * can be used to "unsubscribe" that continuation from the wire.
 * @see {@link Activity}
 * @see {@link Continuation}
 * @category Reactive
 * @public
 * @example
 * ```
 * const broadcaster = new Wire<number>();
 * const a1 = broadcaster.subscribe({
 *   next(n: number) {
 *     console.log("[listener 1]", n);
 *   }
 * });
 * const a2 = broadcaster.subscribe({
 *   next(n: number) {
 *     console.log("[listener 2]", n);
 *   }
 * });
 *
 * broadcaster.next(1);
 * // "[listener 1] 1"
 * // "[listener 2] 2"
 *
 * a1.finish();
 *
 * broadcaster.next(2);
 * // "[listener 2] 2"
 * ```
 */
class Wire<A> extends Site<A> implements Activity, Continuation<A> {
  /**
   * @internal
   * @see {@link Wire.done}
   */
  protected _done = false;

  /**
   * @internal
   */
  protected _subscribers: Continuation<A, unknown>[] = [];

  /**
   * All wires do the same thing when you {@link Wire.subscribe | subscribe}
   * a {@link Continuation} to them: the continuation is added to an internal
   * array, and an {@link Activity} is returned which will unsubscribe the
   * continuation when {@link Activity.finish | finish} is called.
   */
  constructor() {
    super((continuation: Continuation<A, unknown>) => {
      if (this.done) {
        return;
      }
      this._subscribers.push(continuation);
      return () => {
        for (const [index, subscriber] of this._subscribers.entries()) {
          if (subscriber === continuation) {
            this._subscribers.splice(index, 1);
            break;
          }
        }
      };
    });
  }

  /**
   * Flag indicating whether the wire has finished execution.
   * @public
   * @privateRemarks
   * Implemented as a getter to enforce readonly access at runtime.
   */
  get done(): boolean {
    return this._done;
  }

  finish(): void {
    this._subscribers = [];
    this._done = true;
    return;
  }

  next(value: A): void {
    if (this.done) {
      return;
    }
    this._subscribers
      .slice()
      .map((cont: Continuation<A, unknown>): unknown => cont.next(value));
  }
}

/**
 * A dynamic, time-varying value.
 * @category Reactive
 * @see {@link Activity}
 * @see {@link Continuation}
 * @see {@link Wire}
 * @public
 * @example
 * ```typescript
 * const prop = new Signal<number>(0);
 * prop.subscribe({
 *   next() {
 *     console.log("property updated: ", prop.value);
 *   }
 * });   // prints: "property updated: 0"
 * prop.next(1); // "property updated: 1"
 * prop.next(2); // "property updated: 2" ...
 * ```
 */
class Signal<A> extends Wire<A> implements Activity, Continuation<A> {
  /**
   * A Signal is a {@link Wire} which is constructed with an initial
   * {@link Signal.value | value}.
   */
  constructor(
    /**
     * @internal
     * @see {@link Signal.value}
     * @privateRemarks
     * This value must ultimately be mutable but access must be carefully
     * controlled.
     */
    protected _value: A
  ) {
    super();
  }

  /**
   * @public
   * @privateRemarks
   * Implemented as a getter to enforce readonly access to the actual reference
   * at runtime.
   */
  get value(): A {
    return this._value;
  }

  /**
   * In addition to the behavior of {@link Wire.subscribe} this immediately
   * invokes the continuation with the {@link Signal.value | value}.
   */
  subscribe(continuation: Continuation<A> | ((a: A) => unknown)): Activity {
    const activity = super.subscribe(continuation);
    "function" === typeof continuation
      ? continuation(this.value)
      : continuation.next(this.value);
    return activity;
  }

  /**
   * In addition to the behavior of {@link Wire.next} this updates the
   * internal {@link Signal.value | value}.
   */
  next(newValue: A): unknown {
    if (this.done || !newValue) {
      return;
    }
    super.next((this._value = newValue));
  }
}

export {
  Site,
  Wire,
  Signal,
  pure,
  each,
  keep,
  par,
  shift,
  map,
  join,
  filter,
  then,
  prune
};

export type { Activity, Continuation, Operator };
