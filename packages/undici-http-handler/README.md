# @smithy/undici-http-handler

[![NPM version](https://img.shields.io/npm/v/@smithy/undici-http-handler/latest.svg)](https://www.npmjs.com/package/@smithy/undici-http-handler)
[![NPM downloads](https://img.shields.io/npm/dm/@smithy/undici-http-handler.svg)](https://www.npmjs.com/package/@smithy/undici-http-handler)

Smithy-compatible HTTP handler backed by modern, high performance Node.js [undici][] client.

## Usage

Use `UndiciHttpHandler` as a Smithy-compatible request handler for generated
clients. It uses undici for HTTP transport, and accepts optional undici
`Dispatcher` to set up transport details.

### Basic example

```js
import { S3 } from "@aws-sdk/client-s3";
import { UndiciHttpHandler } from "@smithy/undici-http-handler";

const client = new S3({
  requestHandler: new UndiciHttpHandler(),
});

client.listBuckets().then(console.log);
```

### Configuring undici Dispatcher

You can pass `Agent.Options` to configure transport behavior such as connection
pooling and timeouts. The handler creates an `Agent` internally for you.

```js
import { S3 } from "@aws-sdk/client-s3";
import { UndiciHttpHandler } from "@smithy/undici-http-handler";

const client = new S3({
  requestHandler: new UndiciHttpHandler({
    dispatcher: {
      connections: 50,
      headersTimeout: 3000,
      bodyTimeout: 3000,
      connect: {
        timeout: 3000,
      },
    },
  }),
});

client.listBuckets().then(console.log);
```

Alternatively, pass an existing undici `Dispatcher` instance (Agent, Pool,
Client, etc.) directly if you need full control over its lifecycle.

```js
import { S3 } from "@aws-sdk/client-s3";
import { UndiciHttpHandler } from "@smithy/undici-http-handler";
import { Agent } from "undici";

const dispatcher = new Agent({
  connections: 50,
  headersTimeout: 3000,
  bodyTimeout: 3000,
  connect: {
    timeout: 3000,
  },
});

const client = new S3({
  requestHandler: new UndiciHttpHandler({ dispatcher }),
});

client.listBuckets().then(console.log);
```

If every operation made by the SDK client using this handler is guaranteed to
hit the exact same origin (scheme + host + port), you can pass a `Client` for
lower overhead by skipping the per-origin routing that `Agent` performs. A
common case is an AWS Lambda function with a single client calling one fixed
service endpoint. Note that the dispatcher is scoped to the one SDK client this
handler is attached to, not the whole application — other clients get their own
handler.

```js
import { Lambda } from "@aws-sdk/client-lambda";
import { UndiciHttpHandler } from "@smithy/undici-http-handler";
import { Client } from "undici";

const region = "us-east-1";
const endpoint = `https://lambda.${region}.amazonaws.com`;

const dispatcher = new Client(endpoint, {
  pipelining: 1,
  connect: { timeout: 3000 },
});

const client = new Lambda({
  region,
  endpoint,
  requestHandler: new UndiciHttpHandler({ dispatcher }),
});

client.listFunctions({}).then(console.log);
```

> **Warning:** A `Client` is pinned to exactly one origin, so it must not be
> used with an SDK client whose operations may target multiple hosts. A client
> that appears to use one endpoint often still routes individual operations to
> different hosts:
>
> - **Host-prefixed operations.** Operations carrying `@endpoint(hostPrefix)`
>   target a different host. e.g. Amazon CloudWatch Logs `StartLiveTail` uses
>   prefix `stream-`, hitting `stream-logs.<region>.amazonaws.com` while other
>   Logs operations use `logs.<region>.amazonaws.com`.
> - **Amazon S3 virtual-hosted addressing.** `ListBuckets` hits
>   `s3.<region>.amazonaws.com` but bucket-scoped operations hit
>   `<bucket>.s3.<region>.amazonaws.com`.
> - **Amazon DynamoDB account-based routing.** With `AccountIdEndpointMode=preferred`
>   (the default) and an `accountId` on the resolved credentials, operations
>   route to `<account-id>.ddb.<region>.amazonaws.com`. The host depends on the
>   account ID resolved at request time, so it cannot be known when statically
>   constructing a single-origin `Client`.
> - **FIPS/dualstack variants** can also resolve to a different host.
>
> When a request is routed to a host other than the `Client`'s fixed origin, it
> fails TLS validation (`ERR_TLS_CERT_ALTNAME_INVALID`) and leaves the
> dispatcher stuck, so every subsequent request hangs without ever completing.
> If multi-host routing is possible, use the default `Agent` or
> `Agent({ connections: 1 })` for a single connection per origin.

> **Tip:** When you pass your own `Dispatcher`, you control which version of
> `undici` is used. For best performance, install the latest `undici` directly
> in your application — improvements in newer releases (HTTP parser, connection
> pooling, etc.) will then apply to requests made through this handler.

## Benchmarks

Our benchmark spins up a local HTTP server and runs two scenarios:

- **10 sequential GETs** – measures per-request latency when requests are issued
  one after another.
- **50 concurrent GETs** – measures throughput under parallel load using
  `Promise.all`.

The results show UndiciHttpHandler spends **35%-50%** less time in request handling
as compared to NodeHttpHandler from `@smithy/node-http-handler`.

If every operation made by the SDK client hits the exact same origin, passing a
`Client` as the dispatcher gives an additional **5%-20%** improvement over the
default `Agent` by skipping per-origin routing.

> **Warning:** A single-origin `Client` breaks if any operation targets a
> different host (e.g. host-prefixed endpoints, Amazon S3 virtual-hosted
> addressing, Amazon DynamoDB account-based routing). See
> [Configuring undici Dispatcher](#configuring-undici-dispatcher) for details.

We recommend running benchmarks for your own use case on your own setup, as
results will vary depending on workload, network conditions, and environment.

## Migrating from NodeHttpHandler

`UndiciHttpHandler` does not accept the same options as
[`NodeHttpHandler`][node-http-handler].

The `NodeHttpHandler` is configured with top-level timeout fields and
`http.Agent`/`https.Agent` instances, whereas `UndiciHttpHandler` is configured
with a single undici `Dispatcher` (or `Agent.Options`).

### Before / After example

This shows the most commonly configured options. See [Option mapping](#option-mapping) below for the complete list.

```js
// Before: NodeHttpHandler
import { Agent as HttpsAgent } from "node:https";
import { NodeHttpHandler } from "@smithy/node-http-handler";

new NodeHttpHandler({
  connectionTimeout: 3000,
  requestTimeout: 5000,
  socketTimeout: 4000,
  httpsAgent: new HttpsAgent({
    maxSockets: 50,
    keepAlive: true,
    keepAliveMsecs: 1000,
  }),
});
```

```js
// After: UndiciHttpHandler
import { UndiciHttpHandler } from "@smithy/undici-http-handler";

new UndiciHttpHandler({
  dispatcher: {
    connections: 50, // maxSockets
    headersTimeout: 5000, // requestTimeout
    bodyTimeout: 4000, // socketTimeout (inactivity during a request)
    connect: {
      timeout: 3000, // connectionTimeout
      keepAlive: true, // http(s)Agent.keepAlive
      keepAliveInitialDelay: 1000, // http(s)Agent.keepAliveMsecs
    },
  },
});
```

### Option mapping

The sections below map each `NodeHttpHandler` option to its undici equivalent.
When you pass plain options instead of a `Dispatcher` instance, the handler
treats them as undici [`Agent.Options`][undici-agent-options], which extend
[`Pool` options][undici-pool-options] and, in turn, [`Client`
options][undici-client-options]; `connect.*` options come from
[`ConnectOptions`][undici-connect-options].

#### `connectionTimeout`

Maps to [`dispatcher.connect.timeout`][undici-connect-options]. Time allowed for
the connect (and TLS) phase.

#### `requestTimeout`

Maps to [`dispatcher.headersTimeout`][undici-client-options] and
[`dispatcher.bodyTimeout`][undici-client-options]. undici splits this into
time-to-headers and time-between-body-chunks. The per-request `requestTimeout`
option also sets both.

> **Note:** For HTTP/2 connections (`allowH2: true`), undici only uses
> `bodyTimeout` as a unified stream inactivity timeout — `headersTimeout` is
> ignored. The `bodyTimeout` value is passed to `stream.setTimeout()` on the
> HTTP/2 stream, covering both waiting for response headers and waiting for
> body data. If you need a timeout that applies to HTTP/2, set `bodyTimeout`.

#### `socketTimeout`

Maps to [`dispatcher.bodyTimeout`][undici-client-options] and
[`dispatcher.headersTimeout`][undici-client-options]. Node's `socketTimeout`
fires on socket inactivity during an in-flight request. undici's `bodyTimeout`
(time between body chunks) and `headersTimeout` (time waiting for headers) cover
the same stalled-request cases.

> **Note:** For HTTP/2 connections (`allowH2: true`), only `bodyTimeout` is
> used as a stream inactivity timeout — `headersTimeout` is ignored.

#### `httpAgent` / `httpsAgent`

Maps to `dispatcher`. A single undici `Dispatcher` handles both `http:` and
`https:`; there is no separate agent per protocol.

If you previously passed a third-party proxy agent (e.g. `proxy-agent`, `https-proxy-agent`) here, use undici's built-in `ProxyAgent` as the `dispatcher` instead — see [Proxies](#proxies).

The nested agent options map as follows:

- `keepAlive` (`true`) — default behavior. undici pools and reuses
  connections by default. Set [`dispatcher.pipelining: 0`][undici-client-options]
  to avoid reusing a connection for new requests.
- `keepAliveMsecs` — maps to
  [`dispatcher.connect.keepAliveInitialDelay`][undici-connect-options]. TCP
  keep-alive probe delay (`socket.setKeepAlive`). Set `connect.keepAlive: true`
  to enable it on the undici connector.
- `maxSockets` — maps to
  [`dispatcher.connections`][undici-pool-options]. Maximum connections undici
  opens per origin. undici defaults to unlimited; `NodeHttpHandler` defaults to
  `50`.
- `agentKeepAliveTimeoutBuffer` — maps to
  [`dispatcher.keepAliveTimeoutThreshold`][undici-client-options]. Both subtract
  a buffer (in ms) from the server's `keep-alive: timeout=...` hint so the client
  closes the socket slightly before the server does. undici defaults to `2000`.
- `timeout` — maps mainly to [`dispatcher.connect.timeout`][undici-connect-options]
  for the connect phase. Node's Agent `timeout` is the default socket timeout for
  created sockets; undici covers the in-flight side with `headersTimeout` /
  `bodyTimeout` (see `requestTimeout` and `socketTimeout` above).

The following agent options have no direct dispatcher equivalent. undici manages
the connection pool differently, so these knobs are either unnecessary or
unavailable:

- `maxTotalSockets` — undici caps connections per origin (`connections`), not
  globally. The closest option is [`dispatcher.maxOrigins`][undici-agent-options],
  which limits how many origins receive requests, not the total socket count.
- `maxFreeSockets` — undici has no idle-socket count cap. Idle sockets are reaped
  by `keepAliveTimeout` / `keepAliveMaxTimeout` instead.
- `scheduling` — undici uses its own pool scheduling and does not expose a
  free-socket ordering option (`'fifo'` / `'lifo'`).
- `proxyEnv` — Node's built-in env-var proxy support (Node 24+, gated behind
  `NODE_USE_ENV_PROXY`), not a classic `http.Agent` option. undici reads the
  same `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` variables via its
  `EnvHttpProxyAgent` dispatcher — see [Proxies](#proxies).
- `defaultPort` / `protocol` — no per-dispatcher setting. undici derives the
  origin (scheme, host, port) from the request URL, so there is nothing to
  default.

> **Note:** `proxyEnv`, `defaultPort`, and `protocol` are not classic
> `http.Agent` options — they come from Node's built-in proxy support (Node 24+,
> gated behind `NODE_USE_ENV_PROXY`) and are unavailable on older Node versions.

#### `throwOnRequestTimeout`

Default behavior. undici always throws on timeout; this handler surfaces it as a
`TimeoutError`. There is no warning-only mode to opt out of.

#### `socketAcquisitionWarningTimeout`

No equivalent. undici manages its own connection pool queue and does not emit
this warning.

#### `logger`

Maps to `logger`. Passed at the top level, same as `NodeHttpHandler`.

## Migrating from NodeHttp2Handler

`UndiciHttpHandler` can replace [`NodeHttp2Handler`][node-http-handler] for HTTP/2 use cases.

### Before / After example

```js
// Before: NodeHttp2Handler
import { NodeHttp2Handler } from "@smithy/node-http-handler";

new NodeHttp2Handler({
  requestTimeout: 5000,
  sessionTimeout: 30000,
  maxConcurrentStreams: 100,
});
```

```js
// After: UndiciHttpHandler with HTTP/2
import { UndiciHttpHandler } from "@smithy/undici-http-handler";

new UndiciHttpHandler({
  dispatcher: {
    // allowH2 is enabled by default — no need to set it explicitly
    headersTimeout: 5000, // requestTimeout (HTTP/1.1 only, ignored for HTTP/2)
    bodyTimeout: 5000, // requestTimeout
    keepAliveMaxTimeout: 30000, // sessionTimeout
  },
});
```

### Option mapping

#### `requestTimeout`

Maps to [`dispatcher.bodyTimeout`][undici-client-options]. `NodeHttp2Handler`
applies a single timeout to the entire stream; for HTTP/2, undici uses
`bodyTimeout` as a unified stream inactivity timeout via `stream.setTimeout()`,
covering both waiting for response headers and waiting for body data.

> **Note:** `headersTimeout` is ignored for HTTP/2 connections in undici. The
> example above sets both `headersTimeout` and `bodyTimeout` to the same value
> so the configuration works consistently if the connection falls back to
> HTTP/1.1 (where both timeouts apply separately).

#### `sessionTimeout`

Maps to [`dispatcher.keepAliveMaxTimeout`][undici-client-options]. In
`NodeHttp2Handler`, this closes idle HTTP/2 sessions after the specified
duration. undici's `keepAliveMaxTimeout` controls the maximum time a socket stays
open between requests.

#### `disableConcurrentStreams`

No direct equivalent. With `allowH2: true`, undici multiplexes streams over a
single HTTP/2 connection per origin by default. To force one stream per
connection (mimicking `disableConcurrentStreams: true`), set
[`dispatcher.pipelining: 0`][undici-client-options] and
[`dispatcher.connections: 1`][undici-pool-options], though this sacrifices
multiplexing benefits.

#### `maxConcurrentStreams`

No direct equivalent. undici respects the server's `SETTINGS_MAX_CONCURRENT_STREAMS`
but does not expose a client-side cap for HTTP/2 stream concurrency.

#### `nodeHttp2ConnectOptions`

Maps partially to [`dispatcher.connect`][undici-connect-options] for TLS options
(e.g. `ca`, `cert`, `key`, `rejectUnauthorized`). Node-specific HTTP/2 session
options (e.g. `settings`, `createConnection`) have no undici equivalent.

### Key differences

- **HTTP/2 is opt-in.** Unlike `NodeHttp2Handler` (which is always HTTP/2),
  undici defaults to HTTP/1.1. This handler sets `allowH2: true` automatically
  when you pass `Agent.Options`, so HTTP/2 is negotiated via ALPN without
  additional configuration. If you pass your own `Dispatcher` instance, you
  are responsible for enabling `allowH2` yourself.

- **Protocol negotiation.** undici uses ALPN to negotiate HTTP/2 over TLS.
  `NodeHttp2Handler` uses Node's `http2.connect()` which always creates an
  HTTP/2 session.

- **Connection model.** `NodeHttp2Handler` manages a pool of HTTP/2 sessions
  per authority. undici manages connections per origin and multiplexes HTTP/2
  streams when `allowH2` is enabled.

- **Timeout behavior differs by protocol.** For HTTP/1.1, undici uses both
  `headersTimeout` (time waiting for response headers) and `bodyTimeout` (time
  between body chunks) separately. For HTTP/2, only `bodyTimeout` is used — it
  becomes a unified stream inactivity timeout via `stream.setTimeout()`,
  covering both the header and body phases. `headersTimeout` is ignored for
  HTTP/2 streams.

### Preferring HTTP/2 in ALPN negotiation

By default, this handler sets `allowH2: true` so undici can negotiate HTTP/2
via ALPN. However, the default ALPN offer order is `['http/1.1', 'h2']`
(HTTP/1.1 first). Servers that select the protocol by client preference — such
as some load balancers using OpenSSL's `SSL_select_next_proto` semantics — may
negotiate HTTP/1.1 even though both sides support HTTP/2.

To offer HTTP/2 first in the ALPN list, use undici's `preferH2` connector
option (available since undici v8.4.0). This requires passing your own
`Dispatcher` instance because `preferH2` is a connector-level build option
that cannot be set through plain `Agent.Options`:

```js
import { S3 } from "@aws-sdk/client-s3";
import { UndiciHttpHandler } from "@smithy/undici-http-handler";
import { Agent } from "undici"; // >= v8.4.0

const dispatcher = new Agent({
  connect: {
    preferH2: true, // ALPN offer: ['h2', 'http/1.1'] instead of ['http/1.1', 'h2']
  },
});

const client = new S3({
  requestHandler: new UndiciHttpHandler({ dispatcher }),
});
```

When `preferH2` is `true`, the TLS handshake offers `h2` before `http/1.1`.
If the server does not support HTTP/2, ALPN transparently falls back to
HTTP/1.1.

## Proxies

`NodeHttpHandler` has no built-in proxy support, so proxy use typically meant
installing a third-party agent (e.g. `proxy-agent`, `https-proxy-agent`,
`hpagent`) and passing it as `httpAgent`/`httpsAgent`:

```js
// Before: NodeHttpHandler with a third-party proxy agent
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxyAgent = new HttpsProxyAgent("http://localhost:8080");

new NodeHttpHandler({
  httpsAgent: proxyAgent,
});
```

undici ships a `ProxyAgent` (a `Dispatcher`), so you no longer need a
third-party dependency. Pass it as the `dispatcher`:

```js
// After: UndiciHttpHandler with undici's built-in ProxyAgent
import { UndiciHttpHandler } from "@smithy/undici-http-handler";
import { ProxyAgent } from "undici";

const dispatcher = new ProxyAgent("http://localhost:8080");

new UndiciHttpHandler({ dispatcher });
```

To pick up the standard `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` environment
variables automatically, use `EnvHttpProxyAgent` instead:

```js
import { UndiciHttpHandler } from "@smithy/undici-http-handler";
import { EnvHttpProxyAgent } from "undici";

new UndiciHttpHandler({ dispatcher: new EnvHttpProxyAgent() });
```

[undici]: https://undici.nodejs.org/
[node-http-handler]: https://www.npmjs.com/package/@smithy/node-http-handler
[undici-agent-options]: https://github.com/nodejs/undici/blob/main/docs/docs/api/Agent.md#parameter-agentoptions
[undici-pool-options]: https://github.com/nodejs/undici/blob/main/docs/docs/api/Pool.md#parameter-pooloptions
[undici-client-options]: https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md#parameter-clientoptions
[undici-connect-options]: https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md#parameter-connectoptions
[undici-env-proxy-agent]: https://github.com/nodejs/undici/blob/main/docs/docs/api/EnvHttpProxyAgent.md
[undici-proxy-agent]: https://github.com/nodejs/undici/blob/main/docs/docs/api/ProxyAgent.md
