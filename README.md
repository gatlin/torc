# torc

**T**ools for **o**rchestrating **r**eactive **c**omputations.

(Heavily inspired by [RxJS][rxjs]).

[**API Documentation**][torcdocs] is available here.

## Build from source

*The author recommends [nvm][nvm] but is not affiliated with it in any way.*

1. Make sure you're using the correct node version (`nvm use`).
2. Install the dependencies (`npm ci`)
3. (optionally) Run the tests locally (`npm t`).

```shell
git checkout https://github.com/gatlin/torc.git && cd torc
nvm use
npm ci
npm t
```

## Synopsis

```typescript
import { Observable, prune, then, shift, each, pure, par } from "../index";
import { createInterface } from "readline";
import { pipe } from "ts-functional-pipe";

// Create a new Observable publishing lines from stdin.
const stdin = shift<string>((publishLine) => {
  const iface = createInterface({ input: process.stdin });
  void iface.on("line", publishLine);
  return () => void iface.close();
});

// Publishes either `undefined` or a specified value after a given delay.
function delayMS(delayMS: number, value?: unknown): Observable<unknown> {
  return shift<unknown>((callback) => {
    const timer = setTimeout(() => void callback(value), delayMS);
    return () => void clearTimeout(timer);
  });
}

// Displays a message and publishes the first reply to stdin.
function prompt(message: string): Observable<string> {
  console.log(`< ${message}`);
  return prune()(stdin);
}

// Prompt which short-circuits with a default after 5 seconds.
function impatientPrompt(message: string): Observable<string> {
  return prune()(par([prompt(message), delayMS(5000)]));
}

const source = pipe(
  then(() => impatientPrompt("Name a color please: ")),
  then((color?: string) => {
    if (color) {
      return pure(color);
    }
    console.log("5 seconds have passed. Selecting tasteful default.");
    return pure("chartreuse");
  }),
  then((color: string) =>
    each(["red", `${color}`, "blue"])
  )
)(pure());

const sink = {
  counter: 0,
  next(result: unknown) {
    console.log(`[${++this.counter}]`, result);
    return;
  }
};

void source.subscribe(sink);
```

```shell
$> ts-node synopsis.ts
< Name a color please:
# you type "green"
[1] red
[2] green
[3] blue
```

```shell
$> ts-node synopsis.ts
< Name a color please:
# you take more than five seconds to reply ...
5 seconds have passed. Selecting tasteful default.
[1] red
[2] chartreuse
[3] blue
```
## Overview

Torc explores the role of [delimited continuations][delimcc] in reactive
programming.

Torc takes much inspiration from [RxJS][rxjs] and as such its core types have
RxJS equivalents.
It might be helpful to supplement this documentation with the
[RxJS documentation](https://rxjs.dev/api) using the following "Rxsetta Stone".


| Torc            | RxJS              |
|-----------------|-------------------|
| `Observable`    | `Observable`      |
| `Wire`          | `Subject`         |
| `Behavior`      | `BehaviorSubject` |
| `Observer`      | `Observer`        |
| `Activity`      | `Subscription`    |
| `Transformer`   | `Operator`        |

Several of the `Observable` constructors and `Transformers` names are
inspired by the [Orc programming language][orclang].

In the interest of not letting perfect be the enemy of the good - or worse yet,
trying too hard to cram everything I want to say into this README and
*confusing* everyone - I am going to leave it here for now!

[The documentation][torcdocs] is full of examples, however, which may answer
whatever questions you have.

## Questions / Comments / Bugs

Please feel free to email me at <gatlin+torc@niltag.net> or use the Issues
feature on Github!

[rxjs]: //rxjs.dev
[delimcc]: http://okmij.org/ftp/continuations/#tutorial
[comonads]: https://bartoszmilewski.com/2017/01/02/comonads/
[torcdocs]: https://niltag.net/code/torc/modules.html
[orclang]: https://orc.csres.utexas.edu/
[nvm]: https://github.com/nvm-sh/nvm
