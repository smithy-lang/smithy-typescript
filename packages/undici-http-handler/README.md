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

If your application only talks to a single origin (e.g. a Lambda function
calling one service endpoint), you can pass a `Client` for lower overhead by
skipping the per-origin routing that `Agent` performs.

```js
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { UndiciHttpHandler } from "@smithy/undici-http-handler";
import { Client } from "undici";

const region = "us-east-1";
const endpoint = `https://dynamodb.${region}.amazonaws.com`;

const dispatcher = new Client(endpoint, {
  pipelining: 1,
  connect: { timeout: 3000 },
});

const client = new DynamoDB({
  region,
  endpoint,
  requestHandler: new UndiciHttpHandler({ dispatcher }),
});

client.listTables({}).then(console.log);
```

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

If your application only talks to a single origin, passing a `Client` as the
dispatcher gives an additional **5%-20%** improvement over the default `Agent` by
skipping per-origin routing.

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

#### `socketTimeout`

Maps to [`dispatcher.bodyTimeout`][undici-client-options] and
[`dispatcher.headersTimeout`][undici-client-options]. Node's `socketTimeout`
fires on socket inactivity during an in-flight request. undici's `bodyTimeout`
(time between body chunks) and `headersTimeout` (time waiting for headers) cover
the same stalled-request cases.

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

### Proxies

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
