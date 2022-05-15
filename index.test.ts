import { test } from "tap";
import {
  Site,
  Wire,
  Signal,
  map,
  filter,
  join,
  pure,
  keep,
  each,
  then,
  shift,
  par,
  prune
} from "./index";
import type { Activity, Operator } from "./index";

// Utility site for at least 1 test.
function timeoutMS(ms: number, value: unknown = undefined): Site<unknown> {
  return shift((k) => {
    const timer = setTimeout(() => {
      k(value);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  });
}

test("a site generates an activity which finishes as expected", (t) => {
  let total = 0;
  const s1 = new Site((cont) => {
    cont.next(3);
    cont.next(2);
    cont.next(1);
    return () => {
      t.equal(total, 6);
      t.end();
    };
  });
  t.ok("subscribe" in s1);
  const a: Activity = s1.subscribe({
    next(n: number) {
      total += n;
    },
  });
  t.equal(total, 6);
  t.ok("finish" in a);
  a.finish();
});

test("a site may return an Activity directly", (t) => {
  const act: Activity = new Site((cont) => {
    t.ok("next" in cont);
    return {
      finish() {
        t.end();
      },
    };
  }).subscribe({
    next() {
      return;
    },
  });
  t.ok("finish" in act);
  act.finish();
});

test("a site also subscribes unary functions", (t) => {
  let total = 0;
  const s1 = new Site<number>((cont) => {
    cont.next(3);
    cont.next(2);
    cont.next(1);
    return () => {
      t.equal(total, 6);
      t.end();
    };
  });
  t.ok("subscribe" in s1);
  const a: Activity = s1.subscribe((n: number) => {
    total += n;
    return;
  });
  t.equal(total, 6);
  t.ok("finish" in a);
  a.finish();
});

test("pure creates a site from a non-site value", (t) => {
  const s: Site<number> = pure(5);
  s.subscribe({
    next(five: number) {
      t.equal(five, 5);
      t.end();
    },
  }).finish();
});

test("a wire publishes its value to all clients correctly", (t) => {
  const w1 = new Wire<number>();
  const checker = {
    count: 0,
    next(n: number) {
      t.equal(n, 1);
      if (2 === ++this.count) {
        t.end();
      }
    },
  };
  w1.subscribe(checker);
  const w2 = new Wire<number>();
  w1.subscribe(w2);
  w2.subscribe(checker);
  w1.next(1);
});

test("a wire stops when it has been finished", (t) => {
  const w = new Wire<number>();
  t.same(w.done,false);
  w.finish();
  t.same(w.done,true);
  let canary = true;
  w.subscribe({
    next() {
      canary = false;
    },
  });
  new Site((cont) => {
    cont.next(1);
    return () => {
      t.ok(canary);
      t.end();
    };
  })
    .subscribe(w)
    .finish();
});

test("a wire removes a subscriber when its activity is finished", (t) => {
  const w = new Wire<number>();
  const a1 = w.subscribe({
    next(n: number): number {
      return n;
    }
  });
  const a2 = w.subscribe({
    next(n: number): number {
      return n * n;
    }
  });
  const responses1 = w.next(2);
  a1.finish();
  const responses2 = w.next(3);
  a1.finish();
  const responses3 = w.next(4);
  a2.finish();
  t.end();
});

test("a signal exposes its default value and updates when appropriate", (t) => {
  const sig = new Signal<number>(4);
  t.equal(sig.value, 4);
  let counter = 0;
  sig.subscribe({
    next(value: number) {
      counter++;
      if (1 === counter) {
        t.equal(value, 4);
      }
      if (2 === counter) {
        t.equal(value, 1);
        t.end();
      }
    }
  });
  sig.next(1);
});

test("a signal stops updating its value when finished", (t) => {
  const sig = new Signal<number>(0);
  t.equal(sig.value, 0);
  t.same(sig.done, false);
  sig.finish();
  t.same(sig.done, true);
  sig.next(1);
  t.equal(sig.value, 0);
  t.equal(sig.done, true);
  t.end();
});

test("a signal subscribes unary functions correctly", (t) => {
  const sig = new Signal<number>(4);
  t.equal(sig.value, 4);
  let counter = 0;
  sig.subscribe((value: number) => {
    counter++;
    if (1 === counter) {
      t.equal(value, 4);
    }
    if (2 === counter) {
      t.equal(value, 1);
      t.end();
    }
  });
  sig.next(1);
});

test("map operator", (t) => {
  let toggle = true;
  const nums: Site<number> = new Site((cont) => {
    for (let i = 0; i < 10; ++i) {
      cont.next(i);
    }
    return () => {
      t.end();
    };
  });
  map((n: number, idx?: number) => {
    t.ok("undefined" !== typeof idx && idx >= 0 && idx < 10);
    return 0 === n % 2;
  })(nums)
    .subscribe({
      next(v: boolean) {
        t.equal(v, toggle);
        toggle = !toggle;
      },
    })
    .finish();
});

test("filter operator", (t) => {
  const nums: Site<number> = new Site((cont) => {
    for (let i = 0; i < 10; ++i) {
      cont.next(i);
    }
    return () => {
      t.end();
    };
  });
  filter((n: number, idx?: number) => {
    t.ok("undefined" !== typeof idx && idx >= 0 && idx < 10);
    return 0 === n % 2;
  })(nums)
    .subscribe({
      next(n: number) {
        t.ok(0 === n % 2);
      },
    })
    .finish();
});

test("join operator", (t) => {
  const s1 = new Site<Site<number>>((outer) => {
    outer.next(
      new Site((inner) => {
        inner.next(4);
      })
    );
    return () => {
      t.end();
    };
  });
  join()(s1)
    .subscribe({
      next(n: number) {
        t.equal(n, 4);
      },
    })
    .finish();
});

test("keep", (t) => {
  const fn = async (n: number): Promise<boolean> => 0 === n % 2;
  const s: Site<boolean> = keep(fn(4));
  s.subscribe({
    next(isEven: boolean) {
      t.ok(isEven);
      t.end();
    },
  });
});

test("kept promise is cancellable", async (t) => {
  let flag = false;
  const promiseSite = keep(new Promise((resolve) => {
    setTimeout(() => {
      resolve("test");
    }, 2000);
  }));
  const activity = promiseSite.subscribe({
    next(msg: string) {
      t.equal(msg, "test");
      if (flag) {
        t.end();
      }
    }
  });
  // Cancel the "kept promise" before it has a chance to resolve.
  setTimeout(() => {
    activity.finish();
    flag = true;
  }, 500);
});

test("each", (t) => {
  const s: Site<number> = each([1, 2, 3]);
  const checker = {
    count: 0,
    next(n: number) {
      t.equal(n, ++this.count);
    },
  };
  const act: Activity = s.subscribe(checker);
  t.ok("finish" in act);
  act.finish();
  t.end();
});

test("each can be cancelled", (t) => {
  t.end();
});

test("then", (t) => {
  const sequence = [0, 2, 4, 6, 8];
  let index = 0;
  const s: Site<number> = new Site((c) => {
    for (let i = 0; i < 10; i++) {
      c.next(i);
    }
    return () => {
      t.end();
    };
  });
  const op1: Operator<number,number> = then((n: number): Site<number> => {
    return new Site((c) => {
      if (0 === n % 2) {
        c.next(n);
      }
    });
  });
  const op2: Operator<number,string> = then((n) => pure(`${n} is even`));
  op2(op1(s)).subscribe({
    next(msg: string) {
      t.equal(msg, `${sequence[index++]} is even`);
    }
  }).finish();
});

test("shift", (t) => {
  let toggled = false;
  shift(times2 => {
    const six = times2(3);
    return times2(six);
  }).subscribe({
    next(three_then_six: number): number {
      if (!toggled) {
        t.equal(three_then_six, 3);
        toggled = !toggled;
      }
      else {
        t.equal(three_then_six, 6);
        t.end();
      }
      return three_then_six * 2;
    }
  });
});

test("par merges multiple sites into one", (t) => {
  const s: Site<number> = par([
    pure(4),
    pure(3),
    timeoutMS(3000, 1)
  ]);
  const checker = {
    count: 0,
    total: 0,
    next(value: number) {
      this.total += value;
      this.count++;
      if (this.count === 1) {
        t.equal(this.total, 4);
      }
      else if (this.count === 2) {
        t.equal(this.total, 7);
        t.end();
      }
    }
  };
  const activity: Activity = s.subscribe(checker);
  setTimeout(() => {
    activity.finish();
  }, 1500);
});

test("prune commutes a Site to 1 value", (t) => {
  const s: Site<number> = each([1, 2, 3]);
  const checker = {
    count: 0,
    next(value: number) {
      this.count++;
      t.equal(value, 1);
      t.equal(this.count, 1);
      if (1 === this.count) {
        t.end();
      }
    }
  };
  prune()(s).subscribe(checker);
});