# Component `jco transpile` example:  Browser `fetch()`

This repository showcases how to use the Javascript WebAssembly Component toolchain (`jco`) to
transpile a WebAssembly component and run it in the browser, using [native browser `fetch()`][mdn-fetch] via
the [WASI][wasi] HTTP interface ([`wasi:http`][wasi-http]).

Since browsers don't speak WASI natively (yet), we use make use of the
[WASI Preview 2 shims (`@bytecodealliance/preview2-shim`)][p2-shims].

> [!NOTE]
> WebAssembly components are *not* the same as WebAssembly Modules (asm.js, emscripten, etc),
> they are much more powerful and support many more features.
>
> If you don't know what any of the above means, don't worry about it -- check out [Component Model Book][cm-book],
> or keep following along and experiment!

## Quickstart

To make this repository just Do The Thing (tm), you can run:

```console
pnpm go
```
> [!NOTE]
> Feel free to replace `pnpm` with whatever npm-compatible tooling you prefer.

> [!WARNING]
> The `pnpm go` command will never return, so feel free to run it in a new shell/terminal


You should see output like the following:

<details>
<summary><h4>Expected output</h4></summary>

```
❯ pnpm go

> @ go /tmp/test-fetch
> npm run build:component && npm run transpile && npm run serve


> build:component
> jco componentize -w component.wit component.js -o component.wasm

OK Successfully written component.wasm.

> transpile
> jco transpile -o dist/transpiled component.wasm


  Transpiled JS Component Files:

 - dist/transpiled/component.core.wasm                          10.1 MiB
 - dist/transpiled/component.core2.wasm                         13.9 KiB
 - dist/transpiled/component.d.ts                               1.34 KiB
 - dist/transpiled/component.js                                  181 KiB
 - dist/transpiled/interfaces/wasi-cli-stderr.d.ts              0.16 KiB
 - dist/transpiled/interfaces/wasi-cli-stdin.d.ts               0.15 KiB
 - dist/transpiled/interfaces/wasi-cli-stdout.d.ts              0.16 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-input.d.ts       0.1 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-output.d.ts      0.1 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-stderr.d.ts      0.2 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-stdin.d.ts       0.2 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-stdout.d.ts      0.2 KiB
 - dist/transpiled/interfaces/wasi-clocks-monotonic-clock.d.ts  0.31 KiB
 - dist/transpiled/interfaces/wasi-clocks-wall-clock.d.ts       0.19 KiB
 - dist/transpiled/interfaces/wasi-filesystem-preopens.d.ts     0.19 KiB
 - dist/transpiled/interfaces/wasi-filesystem-types.d.ts        2.89 KiB
 - dist/transpiled/interfaces/wasi-http-outgoing-handler.d.ts    0.5 KiB
 - dist/transpiled/interfaces/wasi-http-types.d.ts              8.73 KiB
 - dist/transpiled/interfaces/wasi-io-error.d.ts                0.08 KiB
 - dist/transpiled/interfaces/wasi-io-poll.d.ts                 0.14 KiB
 - dist/transpiled/interfaces/wasi-io-streams.d.ts              0.72 KiB
 - dist/transpiled/interfaces/wasi-random-random.d.ts           0.14 KiB


> serve
> http-server .

Starting up http-server, serving .

http-server version: 14.1.1

http-server settings:
CORS: disabled
Cache: 3600 seconds
Connection Timeout: 120 seconds
Directory Listings: visible
AutoIndex: visible
Serve GZIP Files: false
Serve Brotli Files: false
Default File Extension: none

Available on:
  http://127.0.0.1:8080
  http://192.168.50.129:8080
  http://100.64.0.1:8080
Hit CTRL-C to stop the server
```

</details>

**At this point, you should be able to view the rendered `demo.html` by visiting `localhost:8080/demo.html` in your
favorite browser.**

## Step-by-step

Want to go through it step-by-step? Read along from here.

### Install deps

Install dependencies:

```console
pnpm install
```
> [!NOTE]
> Feel free to replace `pnpm` with whatever npm-compatible tooling you prefer.

### Build the WebAssembly component

You can turn the [JS code](./component.js) in this repository into a WebAssembly component by running:

```console
pnpm build:component
```

<details>
<summary><h4>Expected output</h4></summary>

You should see output like the following:

```console
pnpm build:component

> @ build:component /tmp/test-fetch
> jco componentize -w component.wit component.js -o component.wasm

OK Successfully written component.wasm.
```

</details>

WebAssembly Components are built against the system interfaces available in [WASI][wasi].

For example, using a tool called [`wasm-tools`][wasm-tools] we can see the imports and exports
of the component we've just built. Here's a truncated version:

```wit
package root:component;

world root {
  import wasi:io/error@0.2.2;
  import wasi:io/poll@0.2.2;
  import wasi:io/streams@0.2.2;
  import wasi:cli/stdin@0.2.2;
  import wasi:cli/stdout@0.2.2;
  import wasi:cli/stderr@0.2.2;
  import wasi:cli/terminal-input@0.2.2;
  import wasi:cli/terminal-output@0.2.2;
  import wasi:cli/terminal-stdin@0.2.2;
  import wasi:cli/terminal-stdout@0.2.2;
  import wasi:cli/terminal-stderr@0.2.2;
  import wasi:clocks/monotonic-clock@0.2.2;
  import wasi:clocks/wall-clock@0.2.2;
  import wasi:filesystem/types@0.2.2;
  import wasi:filesystem/preopens@0.2.2;
  import wasi:random/random@0.2.2;
  import wasi:http/types@0.2.2;
  import wasi:http/outgoing-handler@0.2.2; // <---- This is `fetch()`!

  export ping: func(s: string) -> string; // <---- This is implemented in component.js!
}
```

The *meaning* of all of these imports is out of scope for this discussion (and this list can be optimized),
so we'll keep moving for now.

[wasm-tools]: https://github.com/bytecodealliance/wasm-tools

### Transpile the WebAssembly component for in-Browser use

As we noted earlier, WebAssembly Components are built against the system interfaces available in [WASI][wasi].

One of the benefits of using components and WASI is that we can *reimplement* those interfaces when
the platform changes (this is sometimes called "virtual platform layering").

This means that we can actually transpile the component (using `jco`) to produce a bundle of JS + WebAssembly Modules
that can run in the browser:

```console
pnpm transpile
```

<details>
<summary><h4>Expected output</h4></summary>

You should see output like the following:

```
> @ transpile /tmp/test-fetch
> jco transpile -o dist/transpiled component.wasm


  Transpiled JS Component Files:

 - dist/transpiled/component.core.wasm                          10.1 MiB
 - dist/transpiled/component.core2.wasm                         13.9 KiB
 - dist/transpiled/component.d.ts                               1.34 KiB
 - dist/transpiled/component.js                                  181 KiB
 - dist/transpiled/interfaces/wasi-cli-stderr.d.ts              0.16 KiB
 - dist/transpiled/interfaces/wasi-cli-stdin.d.ts               0.15 KiB
 - dist/transpiled/interfaces/wasi-cli-stdout.d.ts              0.16 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-input.d.ts       0.1 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-output.d.ts      0.1 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-stderr.d.ts      0.2 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-stdin.d.ts       0.2 KiB
 - dist/transpiled/interfaces/wasi-cli-terminal-stdout.d.ts      0.2 KiB
 - dist/transpiled/interfaces/wasi-clocks-monotonic-clock.d.ts  0.31 KiB
 - dist/transpiled/interfaces/wasi-clocks-wall-clock.d.ts       0.19 KiB
 - dist/transpiled/interfaces/wasi-filesystem-preopens.d.ts     0.19 KiB
 - dist/transpiled/interfaces/wasi-filesystem-types.d.ts        2.89 KiB
 - dist/transpiled/interfaces/wasi-http-outgoing-handler.d.ts    0.5 KiB
 - dist/transpiled/interfaces/wasi-http-types.d.ts              8.73 KiB
 - dist/transpiled/interfaces/wasi-io-error.d.ts                0.08 KiB
 - dist/transpiled/interfaces/wasi-io-poll.d.ts                 0.14 KiB
 - dist/transpiled/interfaces/wasi-io-streams.d.ts              0.72 KiB
 - dist/transpiled/interfaces/wasi-random-random.d.ts           0.14 KiB
```

</details>

The most important file in the generated bundle is `dist/transpiled/component.js` -- this serves
as the browser entrypoint for the functionality we've just transpiled.

## Run the Demo code

To be able to use our transpiled component, we'll need to write [a litte HTML](./demo.html) for the browser to interpret.

To serve the demo code that makes use of the transpiled code, we can run:

```console
pnpm serve
```

<details>
<summary><h4>Expected output</h4></summary>

You should see output like the following:

```
> serve
> http-server .

Starting up http-server, serving .

http-server version: 14.1.1

http-server settings:
CORS: disabled
Cache: 3600 seconds
Connection Timeout: 120 seconds
Directory Listings: visible
AutoIndex: visible
Serve GZIP Files: false
Serve Brotli Files: false
Default File Extension: none

Available on:
  http://127.0.0.1:8080
  http://192.168.50.129:8080
  http://100.64.0.1:8080
Hit CTRL-C to stop the server
```

</details>

This will start [`http-server`][http-server] (a commonly used utility web server) and serve the project directory.

You can then visit `demo.html` at [http://localhost:8080/demo.html](http://localhost:8080/demo.html), and open the
Developer console.

> [!NOTE]
> We use `http-server` instead of just visiting `demo.html` from a competent browser
> to avoid CORS issues and allow fetching of local files.

[wasi]: https://github.com/WebAssembly/WASI/tree/main
[wasi-http]: https://github.com/WebAssembly/wasi-http
[p2-shims]: https://www.npmjs.com/package/@bytecodealliance/preview2-shim
[cm-book]: https://component-model.bytecodealliance.org/
[http-server]: https://www.npmjs.com/package/http-server
