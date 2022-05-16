# torc

**T**ools for **o**rchestrating **r**eactive **c**omputations.

(Heavily inspired by [RxJS][rxjs]).

[**API Documentation**][torcdocs] is available here.

## Build from source

*The author recommends [nvm][nvm] but is not affiliated with it in any way.*

1. Make sure you're using the correct node version (`nvm use`).
2. Install the dependencies (`npm install`)
3. (optionally) Run the tests locally (`npm run coverage`).

```shell
git checkout https://github.com/gatlin/torc.git && cd torc
nvm use
npm install
npm run coverage
```

## Synopsis

```typescript
import { Site, shift, prune, par, pure, map } from "./index";
import { Interface, createInterface } from "readline";
import { pipe } from "ts-functional-pipe";

const stdin: Site<string> = shift((k) => {
  const iface: Interface = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  iface.on("line", k);
  return () => {
    iface.close();
  }
});

function prompt(message: string): Site<string> {
  console.log(message);
  return prune()(stdin);
}

function timeoutMS(ms: number, value: unknown = undefined): Site<unknown> {
  return shift((k) => {
    const timer = setTimeout(() => void k(value), ms);
    return () => {
      clearTimeout(timer);
    };
  });
}

const source: Site<string> = par([
  prompt("What is your name?"),
  timeoutMS(5000)
]);

const xform = pipe(
  prune(),
  map((name?: string) => "undefined" === typeof name
    ? "TOO SLOW"
    : `Hello, ${name}`)
);

const accumulator = {
  results: 0,
  next(value: unknown) {
    console.log(`[${++this.results}]: ${JSON.stringify(value, null, 2)}`);
  }
};

xform(source).subscribe(accumulator);
```

This will prompt you to enter your name ...

```shell
$> What is your name?
# ... you type "Your Name" ...
[1]: "Hello, Your Name"
```

... but it will only wait for 5 seconds:

```shell
$> What is your name?
# ... you take 5 seconds or longer ...
[1]: "TOO SLOW"
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
| `Site`          | `Observable`      |
| `Wire`          | `Subject`         |
| `Signal`        | `BehaviorSubject` |
| `Continuation`  | `Observer`        |
| `Activity`      | `Subscription`    |
| `Operator`      | `Operator` :-)    |

The term `Site` and some the `Operator`s are inspired by the
[Orc programming language][orclang].

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
