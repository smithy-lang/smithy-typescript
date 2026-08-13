# <img alt="Smithy" src="https://github.com/smithy-lang/smithy/blob/main/docs/_static/smithy-anvil.svg?raw=true" width="32"> Smithy TypeScript Server SDK `@smithy/server-common`

## Alpha software

The Smithy TypeScript Server SDK is an alpha release, and breaking changes may happen between
minor versions in the `0.x` range.

## Intro

This library provides the runtime components for Smithy schema-based server SDKs
in TypeScript. It contains the `SchemaServiceHandler` request pipeline, protocol
implementations (Smithy RPC v2 CBOR, AWS REST JSON, AWS JSON RPC), routing,
input validation, interceptors, auth scheme support, and metrics integration.

The remainder of this document walks through the end-to-end process of going from a Smithy model to a running schema-based server behind Amazon API Gateway.

## Authoring a Smithy Model

A Smithy model defines your service's API contract of operations, input/output
shapes, errors, and protocol traits. Both the server and client SDKs are
generated from this model.

See https://smithy.io/ for details.

Create a model file (e.g. `models/main.smithy`):

```smithy
$version: "2.0"

namespace com.example.greeting

use smithy.protocols#rpcv2Cbor

/// A simple greeting service.
@rpcv2Cbor
service GreetingService {
    version: "2024-01-01"
    operations: [SayHello, GetItem]
    errors: [ServiceError]
}

operation SayHello {
    input := {
        @required
        @length(min: 1, max: 100)
        name: String
    }
    output := {
        @required
        greeting: String
    }
}

@readonly
operation GetItem {
    input := {
        @required
        itemId: String
    }
    output := {
        @required
        itemId: String
        @required
        name: String
        description: String
    }
    errors: [ItemNotFound]
}

@error("client")
structure ItemNotFound {
    @required
    message: String
}

@error("server")
structure ServiceError {
    message: String
}
```

## Generating a Schema-Based Server SDK

The schema-based server SDK is generated using the `typescript-server-codegen`
plugin with `generateServerSchemas` set to `true`. This mode produces a
lightweight server package that uses static operation schemas for routing, serde,
and validation.

Add the following to your `smithy-build.json`:

```json
{
  "version": "1.0",
  "sources": ["models"],
  "maven": {
    "dependencies": ["software.amazon.smithy.typescript:smithy-typescript-codegen:0.52.0"]
  },
  "projections": {
    "server": {
      "plugins": {
        "typescript-server-codegen": {
          "service": "com.example.greeting#GreetingService",
          "package": "@example/greeting-service-server",
          "packageVersion": "0.0.1",
          "generateServerSchemas": true
        }
      }
    }
  }
}
```

Run code generation:

```shell
smithy build
```

The generated server SDK will be in
`build/smithy/server/typescript-server-codegen/`. It includes:

- **`src/server/GreetingServiceHandler.ts`** — A generated subclass of
  `SchemaServiceHandler` with typed constructor requiring handler
  implementations for every operation. All operation schemas are pre-wired.
- **`src/schemas/schemas_0.ts`** — Static operation schema tuples
  (`StaticOperationSchema[]`) describing each operation's HTTP binding,
  input/output structure shapes, and constraint metadata.
- **`src/models/`** — TypeScript interfaces for every input, output, and error
  shape.
- **`src/index.ts`** — Barrel export of the handler, schemas, models, and errors.

The generated handler is a class that allows you to provide async functions that
work directly on typed input and output shapes,
abstracting away the handling of the HTTP request and HTTP response transformations.

You supply one handler function per modeled operation:

```typescript
// Generated code
export class GreetingServiceHandler<Context = {}> extends SchemaServiceHandler<Context> {
  constructor(
    options: SchemaServiceHandlerOptions<Context> & {
      handlers: {
        SayHello: (
          input: SayHelloInput,
          context: ServerRequestContext,
          userContext: Context
        ) => Promise<SayHelloOutput>;
        GetItem: (input: GetItemInput, context: ServerRequestContext, userContext: Context) => Promise<GetItemOutput>;
      };
    }
  ) {
    super({
      ...options,
      validationEnabled: options.validationEnabled ?? true,
      // OPERATION_SCHEMAS come from the generated model.
      operationSchemas: options.operationSchemas ?? OPERATION_SCHEMAS,
    });
  }

  // automatic Smithy HTTP interface inherited from base class.
  public async handle(request: HttpRequest, context: Context): Promise<HttpResponse>;
}
```

Build the generated server package:

```shell
cd build/smithy/server/typescript-server-codegen
yarn && yarn build
```

## Generating a Client SDK

From the same Smithy model, you can also generate a client SDK using the
`typescript-client-codegen` plugin within `smithy-build.json`:

```json
{
  "version": "1.0",
  "sources": ["models"],
  "maven": {
    "dependencies": ["software.amazon.smithy.typescript:smithy-typescript-codegen:0.52.0"]
  },
  "projections": {
    "server": {
      "plugins": {
        "typescript-server-codegen": {
          "service": "com.example.greeting#GreetingService",
          "package": "@example/greeting-service-server",
          "packageVersion": "0.0.1",
          "generateServerSchemas": true
        }
      }
    },
    "client": {
      "plugins": {
        "typescript-client-codegen": {
          "service": "com.example.greeting#GreetingService",
          "package": "@example/greeting-service-client",
          "packageVersion": "0.0.1"
        }
      }
    }
  }
}
```

After `smithy build`, the client SDK is in
`build/smithy/client/typescript-client-codegen/`. It provides:

- **Client class** (`GreetingServiceClient`) with endpoint and protocol
  configuration.
- **Command classes** (`SayHelloCommand`, `GetItemCommand`) for each operation.
- **Types** for all inputs, outputs, and errors.

Build the generated client package:

```shell
cd build/smithy/client/typescript-client-codegen
yarn && yarn build
```

### Client usage

```typescript
import { GreetingServiceClient, SayHelloCommand, GetItemCommand } from "@example/greeting-service-client";

const client = new GreetingServiceClient({
  endpoint: "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod",
});

const response = await client.send(new SayHelloCommand({ name: "World" }));
console.log(response.greeting); // "Hello, World!"
```

## Using the Generated Server with the API Gateway Adapter

The `@smithy/server-apigateway` package adapts the schema-based service handler
to run as an AWS Lambda function behind API Gateway. It converts API
Gateway proxy events (v1 and v2) into `HttpRequest` objects and converts
`HttpResponse` objects back into the proxy result format that API Gateway
expects.

### Installation

In your Lambda function's package, add dependencies on the generated server SDK
and the adapter:

```json
{
  "dependencies": {
    "@example/greeting-service-server": "0.0.1",
    "@smithy/server-apigateway": "^0.2.0",
    "@smithy/server-common": "^0.2.0"
  }
}
```

### Writing the Lambda Handler

The integration involves three steps:

1. Instantiate the generated service handler with your operation
   implementations.
2. Convert the incoming API Gateway event to an `HttpRequest` using
   `convertEvent`.
3. Handle the request and convert the response back to API Gateway format.

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

// generated handler
import { GreetingServiceHandler } from "@example/greeting-service-server";

// converters for APIG
import { convertEvent, convertVersion2Response } from "@smithy/server-apigateway";

// Create the handler once outside the Lambda entry point so it is reused
// across warm invocations.
const serviceHandler = new GreetingServiceHandler({
  handlers: {
    async SayHello(input) {
      return {
        greeting: `Hello, ${input.name}!`,
      };
    },
    async GetItem(input, requestContext) {
      // Your business logic — call DynamoDB, etc.
      const item = await fetchItemFromDatabase(input.itemId);
      if (!item) {
        // Throw a modeled error; the framework serializes it properly as a 400 or 500
        // depending on the modeled error fault attribution.
        const error = new Error(`Item ${input.itemId} not found`);
        error.name = "ItemNotFound";
        (error as any).$fault = "client";
        throw error;
      }
      return {
        itemId: item.itemId,
        name: item.name,
        description: item.description,
      };
    },
  },
});

// Lambda entry point
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const httpRequest = convertEvent(event);
  const httpResponse = await serviceHandler.handle(httpRequest, {});
  return convertVersion2Response(httpResponse);
}
```

### Multi-Protocol Support

The schema-based server can serve multiple protocols simultaneously from the
same handler. The framework inspects request headers to route to the correct
protocol:

```typescript
import {
  SmithyRpcV2CborServerProtocol,
  AwsRestJsonServerProtocol,
  AwsJsonRpcServerProtocol,
} from "@smithy/server-common";

const serviceHandler = new GreetingServiceHandler({
  // you can provide 1 or more ServerProtocols. This is optional!
  // If you don't provide a "protocols" array, the handler will
  // automatically identify and support all known wire protocols.
  protocols: [
    new SmithyRpcV2CborServerProtocol({ defaultNamespace: "com.example.greeting" }),
    new AwsRestJsonServerProtocol({ defaultNamespace: "com.example.greeting" }),
    new AwsJsonRpcServerProtocol({ defaultNamespace: "com.example.greeting" }),
  ],
  handlers: {/* ... */},
});
```

Clients using any of the registered protocols will be handled correctly.

```ts
import {
  AwsJson1_0Protocol,
  AwsJson1_1Protocol,
  AwsRestJsonProtocol,
  AwsSmithyRpcV2CborProtocol,
} from "@aws-sdk/config/protocol";

import { GreetingServiceClient, SayHelloCommand, GetItemCommand } from "@example/greeting-service-client";

const client = new GreetingServiceClient({
  endpoint: "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod",
  protocol: AwsJson1_0Protocol,
});

const client2 = new GreetingServiceClient({
  endpoint: "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod",
  protocol: AwsSmithyRpcV2CborProtocol,
});

// Both clients can communicate with the same server using different protocols.
```

### API Gateway v1 (REST API)

For API Gateway REST APIs using the v1 payload format, use `convertVersion1Response`:

```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { convertEvent, convertVersion1Response } from "@smithy/server-apigateway";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const httpRequest = convertEvent(event);
  const httpResponse = await serviceHandler.handle(httpRequest, {});
  return convertVersion1Response(httpResponse);
}
```

### Event Streams

The schema-based server supports the [Amazon Event Stream](https://smithy.io/2.0/aws/amazon-eventstream.html)
wire format for streaming operations. Event streams enable long-lived
bidirectional communication between client and server using typed events.

There are three streaming patterns:

| Pattern                         | Client sends         | Server sends          |
| ------------------------------- | -------------------- | --------------------- |
| **Output-only** (server→client) | Normal request       | Event stream response |
| **Input-only** (client→server)  | Event stream request | Normal response       |
| **Bidirectional**               | Event stream request | Event stream response |

#### Smithy model

```smithy
/// Output-only: server streams notifications to the client.
operation SubscribeToEvents {
    input := {
        @httpHeader("x-channel")
        channel: String
    }
    output := {
        @httpHeader("x-subscription-id")
        subscriptionId: String

        @httpPayload
        events: NotificationStream
    }
}

/// Input-only: client streams events to the server.
operation PublishEvents {
    input := {
        @httpHeader("x-channel")
        channel: String

        @httpPayload
        events: PublishStream
    }
    output := {
        eventCount: Integer
        message: String
    }
}

/// Bidirectional: both sides stream simultaneously.
operation Chat {
    input := {
        @httpHeader("x-session-id")
        sessionId: String

        @httpPayload
        messages: ChatStream
    }
    output := {
        @httpHeader("x-session-id")
        sessionId: String

        @httpPayload
        messages: ChatStream
    }
}

@streaming
union NotificationStream {
    notification: Notification
    heartbeat: Heartbeat
}

@streaming
union PublishStream { /* ... */ }

@streaming
union ChatStream { /* ... */ }
```

#### Server handler implementation

Event stream members appear as `AsyncIterable<T>` in both input and output
types. To consume an incoming stream, iterate it with `for await`. To produce
an outgoing stream, return an async generator.

```typescript
const serviceHandler = new MyServiceHandler({
  protocols: [/* ... */],
  handlers: {
    // Output-only: return an async generator for the response stream.
    async SubscribeToEvents(input) {
      const channel = input.channel ?? "default";
      return {
        subscriptionId: `sub-${channel}`,
        events: (async function* () {
          for (let i = 0; i < 10; i++) {
            yield { notification: { topic: channel, payload: `event-${i}` } };
            await sleep(1000);
          }
        })(),
      };
    },

    // Input-only: consume the incoming stream, return a normal response.
    async PublishEvents(input) {
      let count = 0;
      for await (const event of input.events) {
        count++;
        processEvent(event);
      }
      return { eventCount: count, message: `Processed ${count} events` };
    },

    // Bidirectional: consume input stream and produce output stream.
    async Chat(input) {
      const inputMessages = input.messages;
      return {
        sessionId: `ack-${input.sessionId}`,
        messages: (async function* () {
          for await (const msg of inputMessages) {
            // Echo back a response for each incoming message.
            yield { response: { text: `Got: ${msg.message?.text}` } };
          }
        })(),
      };
    },
  },
});
```

#### Client-side usage

From the client SDK, event stream operations use the same async iterable
pattern:

```typescript
import { MyServiceClient, SubscribeToEventsCommand, PublishEventsCommand } from "@example/my-client";

const client = new MyServiceClient({ endpoint: "http://localhost:8080" });

// Output-only: iterate the response stream.
const response = await client.send(new SubscribeToEventsCommand({ channel: "news" }));
console.log(response.subscriptionId);
for await (const event of response.events) {
  console.log(event.notification?.payload);
}

// Input-only: pass an async generator as the request stream.
await client.send(
  new PublishEventsCommand({
    channel: "metrics",
    events: (async function* () {
      yield { metric: { name: "cpu", value: 0.85 } };
      yield { metric: { name: "mem", value: 0.6 } };
    })(),
  })
);
```

#### HTTP transport requirements

Event streams use the `application/vnd.amazon.eventstream` binary framing
format.

- **Output-only streams** work over HTTP/1.1 using chunked transfer encoding
  on the response.
- **Input-only streams** can work over HTTP/1.1 (chunked request body) or
  HTTP/2, depending on the service's `eventStreamHttp` trait.
- **Bidirectional streams** require HTTP/2 for full-duplex communication.

See the [`@smithy/server-node` README](../server-node/README.md) for an example
of setting up an HTTP/2 server that supports bidirectional event streams.

When the service's protocol trait includes `eventStreamHttp: ["h2"]`, the
generated client automatically uses `NodeHttp2Handler`:

```smithy
@rpcv2Cbor(
    http: ["h2", "http/1.1"]
    eventStreamHttp: ["h2"]
)
service MyService { /* ... */ }
```

Output-only event streams work over HTTP/1.1 (the request is normal; only the
response body streams).

#### RPC vs REST protocol differences

For **RPC protocols** (Smithy RPC v2 CBOR, AWS JSON 1.0/1.1), non-stream
members of the input/output are serialized as an `initial-request` or
`initial-response` message — the first event in the stream.

For **REST protocols** (AWS restJson1), non-stream members are bound to HTTP
headers, URI path labels, or query parameters. They do not appear in the
event stream itself. The event stream member must carry `@httpPayload`.

#### Lambda / API Gateway limitations

> **Important:** AWS Lambda does not support incoming request streams or
> bidirectional event streams. The Lambda execution model buffers the full
> request body before invoking the handler, and does not support streaming
> the request.
>
> - **Output-only streams** (server→client) are supported via Lambda response
>   streaming (`awslambda.streamifyResponse`) with HTTP API (API Gateway v2).
> - **Input-only and bidirectional streams** are **not supported** on Lambda.
>   These require a long-lived connection (e.g., a Node.js HTTP/2 server on
>   EC2, ECS, or Fargate).
>
> The `@smithy/server-apigateway` adapter does not support event stream
> operations. Use `@smithy/server-node` with an HTTP/2 server for full
> event stream support.

### Passing User Context

The `handle` method's second argument is a user-defined context object that
flows through to every operation handler. Use it to pass request-scoped data
like the Lambda context or pre-resolved identity information:

```typescript
interface MyContext {
  lambdaRequestId: string;
  accountId: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const httpRequest = convertEvent(event);
  const context: MyContext = {
    lambdaRequestId: event.requestContext.requestId,
    accountId: event.requestContext.accountId,
  };
  const httpResponse = await serviceHandler.handle(httpRequest, context);
  return convertVersion2Response(httpResponse);
}
```

Your operation handlers receive this as the third argument (after the framework-
provided `ServerRequestContext`):

```typescript
handlers: {
  async SayHello(input, requestContext, userContext) {
    console.log(`Request ${userContext.lambdaRequestId} from ${userContext.accountId}`);
    console.log(`Operation: ${requestContext.operation}`);
    return { greeting: `Hello, ${input.name}!` };
  },
}
```

The `requestContext` (second argument) is always provided by the framework and
contains:

- `request` — the original HTTP request metadata (method, path, query, headers)
- `operation` — the resolved operation name
- `caller` — the authenticated caller identity (if auth schemes are configured)

### Input Validation

The schema-based server validates deserialized input against Smithy constraint
traits before invoking your handler. This is enabled by default
(`validationEnabled: true`). Supported constraints include:

- `@required` — member must be present
- `@length` — string/list/map length bounds
- `@range` — numeric min/max bounds
- `@pattern` — regex pattern matching
- `@uniqueItems` — list elements must be distinct
- `@enum` / `@intEnum` — restricted value sets

When validation fails, the framework returns a `ValidationException` error
response to the client without calling your handler. To disable validation:

```typescript
const serviceHandler = new GreetingServiceHandler({
  protocols: [/* ... */],
  handlers: {/* ... */},
  validationEnabled: false,
});
```

### Adding Auth Schemes

Register auth schemes to authenticate requests before they reach deserialization.
Schemes are tried in registration order; the first to return a non-null `Caller`
wins. If all schemes return null, the framework responds with
`UnauthenticatedException`:

```typescript
serviceHandler.withAuth({
  name: "api-key",
  async authenticate(request, context) {
    const key = request.headers["x-api-key"];
    if (!key) return null; // decline — try next scheme
    const principal = await validateApiKey(key);
    return { principal };
  },
});
```

The authenticated `Caller` is available via `requestContext.caller` in your
handlers.

### Adding Interceptors

Interceptors hook into the request pipeline for cross-cutting concerns. There
are two kinds of hooks:

- **Read hooks** (`read*`) — observe a pipeline step without modifying it.
- **Modify hooks** (`modify*`) — return a replacement value for the next step.

```typescript
serviceHandler.addInterceptor({
  readBeforeExecution({ request }) {
    console.log(`→ ${request.method} ${request.path}`);
  },
  modifyBeforeValidation({ input, operation }) {
    // Normalize input before validation runs
    if (operation === "SayHello" && typeof (input as any).name === "string") {
      return { ...(input as any), name: (input as any).name.trim() };
    }
    return input;
  },
  modifyBeforeSerialization({ output, operation }) {
    // Add a computed field to every response
    return { ...(output as any), servedAt: new Date().toISOString() };
  },
  readAfterExecution({ operation, error }) {
    if (error) console.error(`✗ ${operation}:`, error);
  },
});
```

The full interceptor hook order is:

1. `readBeforeExecution`
2. `readAfterAuthentication`
3. `modifyBeforeDeserialization` → can replace the `HttpRequest`
4. `readAfterDeserialization`
5. `modifyBeforeValidation` → can replace the deserialized input
6. `readBeforeInvocation`
7. _(handler invocation)_
8. `readAfterInvocation`
9. `modifyBeforeSerialization` → can replace the handler output
10. `readAfterSerialization`
11. `modifyBeforeCompletion` → can replace the `HttpResponse`
12. `readAfterExecution`

### Metrics

Register a `MetricsRecorderFactory` to record per-request lifecycle timings:

```typescript
serviceHandler.withMetrics({
  create() {
    return {
      begin() {
        /* request started */
      },
      recordTimed(phase, durationMs) {
        /* e.g. "Deserialize", "Invoke" */
      },
      recordRequestOutcome(outcome, totalMs) {
        /* "Success" or "Fault" */
      },
      end() {
        /* request completed */
      },
    };
  },
});
```

### Error Handling

The `onError` callback lets you intercept errors before they are serialized:

```typescript
const serviceHandler = new GreetingServiceHandler({
  protocols: [/* ... */],
  handlers: {/* ... */},
  onError(operation, error) {
    // Log all errors
    console.error(`[${operation}]`, error);
    // Return undefined to use default error handling
    return undefined;
  },
});
```

### API Gateway Configuration

Configure your API Gateway with a catch-all proxy route so all requests
are forwarded to the Lambda function and routed by the Smithy server internally:

- **HTTP API (v2):** Use a `$default` route or `ANY /{proxy+}` integration
  pointing to the Lambda.
- **REST API (v1):** Use a `{proxy+}` resource with `ANY` method and Lambda
  proxy integration enabled.

The schema-based handler performs its own routing using protocol headers and
operation schemas, so API Gateway only needs to forward the raw HTTP
request.

### Request Pipeline

When a request arrives, `convertEvent()` transforms the API Gateway event into
a Smithy `HttpRequest`, and the `SchemaServiceHandler` executes the following steps in
order:

1. **Route** — Inspect request headers and path to determine which registered
   protocol claims the request, then resolve the target operation name.
2. **Authenticate** — Run registered auth schemes in order. The first to return
   a `Caller` wins; if all decline, respond with `UnauthenticatedException`.
3. **Deserialize** — Parse the request body into a typed input object using the
   matched protocol's serde logic.
4. **Validate** — Check the deserialized input against Smithy constraint traits
   (`@required`, `@length`, `@range`, `@pattern`, etc.). Reject with
   `ValidationException` on failure.
5. **Invoke** — Call your operation handler with the validated input.
6. **Serialize** — Encode the handler's output into an `HttpResponse` using the
   matched protocol.

The resulting `HttpResponse` is then passed to `convertVersion2Response()` (or
`convertVersion1Response()`) to produce the final API Gateway result.

Interceptor hooks run between each step, providing observe-only and mutation
extension points at every boundary. If any step throws, the error path
serializes an appropriate error response using the matched protocol.
