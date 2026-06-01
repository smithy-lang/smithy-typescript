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

## Migrating from NodeHttpHandler

`UndiciHttpHandler` does not accept the same options as
[`NodeHttpHandler`][node-http-handler].

The `NodeHttpHandler` is configured with top-level timeout fields and
`http.Agent`/`https.Agent` instances, whereas `UndiciHttpHandler` is configured
with a single undici `Dispatcher` (or `Agent.Options`).

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
`https:`; there is no separate agent per protocol. The nested agent options map
as follows:

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

#### `throwOnRequestTimeout`

Default behavior. undici always throws on timeout; this handler surfaces it as a
`TimeoutError`. There is no warning-only mode to opt out of.

#### `socketAcquisitionWarningTimeout`

No equivalent. undici manages its own connection pool queue and does not emit
this warning.

#### `logger`

Maps to `logger`. Passed at the top level, same as `NodeHttpHandler`.

> **Note:** undici also has a `keepAliveTimeout` option, but it has no
> `NodeHttpHandler` counterpart. It controls how long an _idle_ pooled socket
> (with no active requests) is kept open for reuse — a different concept from
> `socketTimeout`, which guards against inactivity during an in-flight request.

### Before / after example

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
    connections: 50,
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

## Benchmarks

Our benchmark spin up a local HTTP server and runs two scenarios:

- **10 sequential GETs** – measures per-request latency when requests are issued
  one after another.
- **50 concurrent GETs** – measures throughput under parallel load using
  `Promise.all`.

The results show UndiciHttpHandler spends **35%-45%** less time in request handling
as compared to NodeHttpHandler from `@smithy/node-http-handler`.

We recommend running benchmarks for your own use case on your own setup, as
results will vary depending on workload, network conditions, and environment.

[undici]: https://undici.nodejs.org/
[node-http-handler]: https://www.npmjs.com/package/@smithy/node-http-handler
[undici-agent-options]: https://github.com/nodejs/undici/blob/main/docs/docs/api/Agent.md#parameter-agentoptions
[undici-pool-options]: https://github.com/nodejs/undici/blob/main/docs/docs/api/Pool.md#parameter-pooloptions
[undici-client-options]: https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md#parameter-clientoptions
[undici-connect-options]: https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md#parameter-connectoptions
