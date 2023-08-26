/**
 * Tools for Orchestrating Reactive Computations
 * @packageDocumentation
 */

/**
 * Represents an ongoing computation, behavior, or process which may be halted
 * at any time with the {@link Activity.finish} method.
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
interface Observer<A, B = void> {
  next(value?: A): B;
}

/**
 * A computation which may asynchronously publish 0-or-more values to a
 * subscribing {@link Observer}.

 * An {@link Observable | `Observable<A>`} for some type `A` defines a
 * *double negation* of values of type `A`.
 * As such its {@link Observable.constructor | constructor} is protected to prevent
 * misuse.
 * Instead, it is used to define other classes.
 *
 * @see {@link Wire} a sub-class for event broadcasting.
 * @see {@link Behavior} for a dynamic store (as seen in Svelte).
 * @typeParam A - the value type published by this Observable.
 * @category Base
 * @internal
 */
class Observable<A> {
  protected constructor(
    private _action: (c: Observer<A, unknown>) => Activity | (() => void) | void
  ) {}

  /**
   * @typeParam B - Type returned by the incoming observer.
   * @param observer - This function will be called each time the observable
   * publishes a value.
   */
  public subscribe<B = void>(
    observer: Observer<A, B> | ((a: A) => B)
  ): Activity {
    const finish =
      "function" === typeof observer
        ? this._action({
            next(v: A): B {
              return observer(v);
            }
          })
        : this._action(observer);
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
 * Lifts an arbitrary value of any type into an {@link Observable} of that type
 * which will publish immediately exactly one time.
 * @category Site
 * @public
 * @example
 * ```typescript
 * const simple = pure(4);
 * simple.subscribe((n: number) =>
 *   void console.log(`simple value: ${n}`)
 * );
 * ```
 * @example
 * ```shell
 * # prints
 * simple value: 4
 * ```
 */
function pure<A>(value?: A): Observable<A> {
  return new (class extends Observable<A> {
    constructor() {
      super((observer: Observer<typeof value>) => observer.next(value));
    }
  })();
}

/**
 * Construct an Observable using a (delimited) continuation-passing idiom.
 * @param fn - A function whose argument is a delimited continuation.
 * @returns An {@link Observable}.
 * @category Site
 * @experimental
 * @example
 * ```typescript
 * shift(times2 => {
 *   const six = times2(3);
 *   void times2(six);
 * }).subscribe(
 *   (three_then_six: number): number => {
 *     console.log(`three_then_six = ${three_then_six}`);
 *     return three_then_six * 2;
 *   }
 * );
 * ```
 * @example
 * ```shell
 * # prints
 * three_then_six = 3
 * three_then_six = 6
 * ```
 */
function shift<A>(fn: (k: (value: A) => unknown) => void): Observable<A> {
  return new (class extends Observable<A> {
    constructor() {
      super((observer) => fn((value: A) => observer.next(value)));
    }
  })();
}

/**
 * Create an {@link Observable} which publishes each value of an `Iterable`
 * object.
 * @category Site
 * @public
 * @example
 * ```typescript
 * const array = each([1, 2, 3]);
 * array.subscribe(
 *   (n: number) => void console.log(`received: ${n}`)
 * );
 * ```
 * @example
 * ```shell
 * # prints
 * received: 1
 * received: 2
 * received: 3
 *```
 */
function each<A>(it: Iterable<A>): Observable<A> {
  return new (class extends Observable<A> {
    constructor() {
      super((observer) => {
        let cancelled = false;
        void setTimeout(() => {
          for (const value of it) {
            if (cancelled) {
              break;
            } else {
              observer.next(value);
            }
          }
        }, 0);
        return () => {
          cancelled = true;
        };
      });
    }
  })();
}

/**
 * Converts a `Promise` into an {@link Observable} which fires once.
 * Any exceptions thrown while awaiting the promise will be re-thrown.
 * If an exception is thrown the observer will definitely not be called.
 * @category Site
 * @public
 * @remarks
 * A `Promise` may be thought of as a linear Observable; an Observable may be
 * thought of as a non-linear `Promise`.
 * @example
 * ```typescript
 * const promise = keep(new Promise((resolve) => {
 *   setTimeout(() => {
 *     resolve("hello from 2 seconds ago");
 *   }, 2000);
 * }));
 * const activity = promise.subscribe(
 *   (msg: string) => void console.log(msg)
 * );
 * ```
 * @example
 * ```shell
 * # prints
 * hello from 2 seconds ago
 * ```
 */
function keep<A>(promise: PromiseLike<A>): Observable<A> {
  return new (class extends Observable<A> {
    constructor() {
      super((observer) => {
        let cancelled = false;
        promise.then((value) => {
          if (!cancelled) {
            observer.next(value);
          }
        });
        return () => {
          cancelled = true;
        };
      });
    }
  })();
}

/**
 * Merges, concurrently, multiple {@link Observable | observables} into one.
 * @category Site
 * @param observables - The sites whose results are to b
 * @returns An observable which executes multiple sites in parallel and merges
 * their result values.
 * @example
 * ```typescript
 * void par([
 *   pure("A"),
 *   pure("B"),
 *   pure("C")
 * ]).subscribe((v: string) => void console.log(v));
 * ```
 * @example
 * ```shell
 * A
 * B
 * C
 * ```
 */
function par<A>(observables: Iterable<Observable<A>>): Observable<A> {
  return new (class extends Observable<A> {
    constructor() {
      super((observer) => {
        const activities: Activity[] = [];
        for (const observable of observables) {
          setTimeout(() => {
            const activity = observable.subscribe(observer);
            activities.push(activity);
          }, 0);
        }
        return () => {
          activities.slice().forEach((activity) => void activity.finish());
        };
      });
    }
  })();
}

/**
 * A function mapping a {@link Observable} from one type to another.
 * @category Base
 * @public
 */
interface Transformer<A, B> {
  (s: Observable<A>): Observable<B>;
}

/**
 * Lifts a simple function `A => B` into a {@link Transformer}.
 * @see {@link Transformer}
 * @see {@link then}
 * @category Transformer
 * @public
 */
function map<A, B>(fn: (value: A, index?: number) => B): Transformer<A, B> {
  return (source) =>
    shift((observer) =>
      source.subscribe({
        count: 0,
        next(value: A) {
          return observer(fn(value, this.count++));
        }
      } as Observer<A, B>)
    );
}

/**
 * Flattens an {@link Observable| nested Observable}.
 * @see {@link Transformer}
 * @see {@link then}
 * @category Transformer
 * @public
 */
function join<A>(): Transformer<Observable<A>, A> {
  return (source) =>
    shift((observer) =>
      source.subscribe((value: Observable<A>) => value.subscribe(observer))
    );
}

/**
 * A useful composition of {@link map} and {@link join}.
 * @see {@link Transformer}
 * @category Transformer
 * @public
 * @example
 * ```typescript
 * const fn = then((numList: number[]) => each(numList));
 * void fn(pure([1, 2, 3])).subscribe((n) => void console.log(`n = ${n}`));
 * ```
 * @example
 * ```shell
 * # prints
 * n = 1
 * n = 2
 * n = 3
 * ```
 */
function then<A, B>(fn: (a: A) => Observable<B>): Transformer<A, B> {
  return (source) => join()(map(fn)(source));
}

/**
 * Filters out values from an {@link Observable} which do not satisfy the given
 * predicate.
 * @param fn - The predicate function which will test each upstream value.
 * @see {@link Transformer}
 * @category Transformer
 * @public
 */
function filter<A>(
  fn: (value: A, index?: number) => boolean
): Transformer<A, A> {
  return (source) =>
    shift((observer) =>
      source.subscribe({
        count: 0,
        next(value: A) {
          if (fn(value, this.count++)) {
            return observer(value);
          }
        }
      } as Observer<A, unknown>)
    );
}

/**
 * An {@link Transformer} which commutes an {@link Observable} to one result
 * value before {@link Activity.finish | finishing}.
 * @returns A new observable which publishes one value.
 * @category Transformer
 * @example
 * ```typescript
 * const three = prune()(each([3, 2, 1]));
 * void three.subscribe((n: number) => void console.log(`n = ${n}`));
 * ```
 * @example
 * ```shell
 * n = 3
 * ```
 */
function prune<A>(): Transformer<A, A> {
  return (source) =>
    shift((observer) => {
      const activity = source.subscribe((value: A): unknown => {
        activity.finish();
        return observer(value);
      });
      return activity;
    });
}

/**
 * Awaits the first published value from an {@link Observable} and transforms
 * it into a `Promise`.
 * The observable's {@link Activity} is finished, allowing for automatic
 * resource disposal.
 * @category Transformer
 */
function reset<A>(observable: Observable<A>): Promise<A> {
  const pruned: Observable<A> = prune()(observable);
  return new Promise<A>((resolve) => void pruned.subscribe(resolve));
}

/**
 * An {@link Observable} which relays a value to 0 or more subscribing
 * {@link Observer | observers}.
 *
 * You may stop the wire from executing by calling {@link .finish}.
 * The {@link Activity} returned by {@link Wire.subscribe | subscribing} to it
 * can be used to "unsubscribe" that observer from the wire.
 * @see {@link Activity}
 * @see {@link Observer}
 * @category Base
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
class Wire<A> extends Observable<A> implements Activity, Observer<A> {
  protected _done = false;

  protected _subscribers: Observer<A, unknown>[] = [];

  /**
   * A Wire pushes subscribing observers into
   * {@link this._subscribers | an array of subscribers}.
   * The returned {@link Activity} will unsubscribe the observer.
   */
  constructor() {
    super((observer: Observer<A, unknown>) => {
      if (!this.done) {
        this._subscribers.push(observer);
        return () => {
          for (const [index, subscriber] of this._subscribers.entries()) {
            if (subscriber === observer) {
              this._subscribers.splice(index, 1);
              break;
            }
          }
        };
      }
    });
  }

  /**
   * Flag indicating whether the wire has finished execution.
   * @public
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
    if (!this.done) {
      this._subscribers
        .slice()
        .forEach((cont: Observer<A, unknown>): unknown => cont.next(value));
    }
    return;
  }
}

/**
 * A dynamic, time-varying value.
 * @see {@link Activity}
 * @see {@link Observer}
 * @see {@link Wire}
 * @category Base
 * @public
 * @example
 * ```typescript
 * const prop = new Behavior<number>(0);
 * prop.subscribe(() => {
 *   console.log("property updated: ", prop.value);
 * });   // prints: "property updated: 0"
 * prop.next(1); // "property updated: 1"
 * prop.next(2); // "property updated: 2" ...
 * ```
 */
class Behavior<A> extends Wire<A> implements Activity, Observer<A> {
  /**
   * A Behavior is a {@link Wire} which is constructed with an initial
   * {@link Behavior.value | value}.
   */
  constructor(protected _value: A) {
    super();
  }

  get value(): A {
    return this._value;
  }

  /**
   * In addition to the behavior of {@link Wire.subscribe} this immediately
   * invokes the observer with the {@link Behavior.value | value}.
   */
  subscribe(observer: Observer<A> | ((a: A) => unknown)): Activity {
    const activity = super.subscribe(observer);
    "function" === typeof observer
      ? observer(this.value)
      : observer.next(this.value);
    return activity;
  }

  /**
   * In addition to the behavior of {@link Wire.next} this updates the
   * internal {@link Behavior.value | value}.
   */
  next(newValue: A): unknown {
    if (!this.done) {
      super.next((this._value = newValue));
    }
    return;
  }

  /*
  public map<B>(fn: (a: A) => B): Behavior<B> {
    const mapped = new Behavior(fn(this.value));
    this.subscribe(() => void mapped.next(fn(this.value)));
    return mapped;
  }

  public fork(): Behavior<Behavior<A>> {
    const forked = new Behavior(this);
    this.subscribe(() => void forked.next(this));
    return forked;
  }

  public apply<B, C>(this: Behavior<(b: B) => C>, that: Behavior<B>): Behavior<C> {
    const applied = new Behavior(this.value(that.value));
    this.subscribe(() => void applied.next(this.value(that.value)));
    that.subscribe(() => void applied.next(this.value(that.value)));
    return applied;
  }

  public thus<B>(fn: (sa: Behavior<A>) => B): Behavior<B> {
    return this.fork().map(fn);
  }
  */
}

export {
  Observable,
  pure,
  shift,
  each,
  par,
  keep,
  Wire,
  Behavior,
  map,
  join,
  filter,
  then,
  prune,
  reset
};
export type { Activity, Observer, Transformer };
