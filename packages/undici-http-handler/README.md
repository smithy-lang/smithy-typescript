# @smithy/undici-http-handler

[![NPM version](https://img.shields.io/npm/v/@smithy/undici-http-handler/latest.svg)](https://www.npmjs.com/package/@smithy/undici-http-handler)
[![NPM downloads](https://img.shields.io/npm/dm/@smithy/undici-http-handler.svg)](https://www.npmjs.com/package/@smithy/undici-http-handler)

Smithy-compatible HTTP handler backed by modern and high performance Node.js [undici][].

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
