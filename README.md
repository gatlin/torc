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
[torcdocs]: https://niltag.net/code/torc
[orclang]: https://orc.csres.utexas.edu/
[nvm]: https://github.com/nvm-sh/nvm
