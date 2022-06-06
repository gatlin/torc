# torc

**T**ools for **o**rchestrating **r**eactive **c**omputations.

(Heavily inspired by [RxJS][rxjs]).

[**API Documentation**][torcdocs] is available here.

## Build from source

*The author recommends [nvm][nvm] but is not affiliated with it in any way.*

1. Make sure you're using the correct node version (`nvm use`).
2. Install the dependencies (`npm ci`)
3. (optionally) Run the tests locally (`npm run coverage`).

```shell
git checkout https://github.com/gatlin/torc.git && cd torc
nvm use
npm ci 
npm run coverage
```

## Synopsis

```typescript
import { Site, prune, then } from "./index";
import { createInterface } from "readline";
import { pipe } from "ts-functional-pipe";

// Publishes either `undefined` or a specified value after a given delay.
function timerMS(delayMS: number, value?: unknown): Site<unknown> {
  return Site.shift((k) => {
    const timer = setTimeout(() => void k(value), delayMS);
    return () => void clearTimeout(timer);
  });
}

// Create a new Site publishing lines from stdin.
const stdin = Site.shift<string>((handleLine) => {
  const iface = createInterface({ input: process.stdin });
  void iface.on("line", handleLine);
  return () => void iface.close();
});

// Displays a message and publishes the first reply to stdin.
function prompt(message: string): Site<string> {
  console.log(`< ${message}`);
  return prune()(stdin);
}

// Prompt which short-circuits with `undefined` after 5 seconds.
const impatientPrompt = (message: string): Site<string> =>
  prune()(Site.par([prompt(message), timerMS(5000)]));

// A reactive pipeline with side-effects.
const source = pipe(
  then(() => impatientPrompt("Hello! What is your name?")),
  then((name: string) =>
    prompt(
      !name
        ? "Anonymity is fine, too. How old are you?"
        : `Charmed, ${name}! How old are you?`
    )
  ),
  then((ageS: string) => {
    console.log(`Wow! That is ${parseInt(ageS, 10) * 7} in dog years!`);
    return Site.each(Array(parseInt(ageS, 10)));
  }),
  then(() => Site.pure("Happy belated birthday!"))
)(Site.pure());

// A sink for the values coming out of the pipe.
const sink = {
  counter: 0,
  next(result: unknown) {
    console.log(`[Year: ${++this.counter}] ${result}`);
    return;
  }
};

void source.subscribe(sink);
```

```shell
$> ts-node synopsis.ts
> Hello! What is your name?
Gatlin
> Charmed, Gatlin! How old are you?
33
Wow! That is 231 in dog years!
[Year: 1] Happy belated birthday!
[Year: 2] Happy belated birthday!
# ... skip a few lines ...
[Year: 32] Happy belated birthday!
[Year: 33] Happy belated birthday!
```

```shell
$> ts-node synopsis.ts
> Hello! What is your name?
# ... 5 seconds pass without a response ...
> Anonymity is fine, too. How old are you?
3
Wow! That is 21 in dog years!
[Year: 1] Happy belated birthday!
[Year: 2] Happy belated birthday!
[Year: 3] Happy belated birthday!
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
