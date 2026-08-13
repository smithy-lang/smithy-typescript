# `@smithy-typescript/server-node`

This package provides glue code to enable using a server sdk with Node.js.

## Alpha software

The Smithy TypeScript Server SDK is an alpha release, and breaking changes may happen between
minor versions in the `0.x` range.

## Usage

```typescript
import { createServer } from "node:http";
import { convertRequest, writeResponse } from "@smithy/server-node";

// This is instantiated from your generated Server SDK package.
// It is either a ServiceHandler type or SchemaServiceHandler extension,
// both of which have a method `handle(HttpRequest): Promise<HttpResponse>`.
const serviceHandler = ...

const server = createServer(async (req, res) => {
  // Convert NodeJS's http request to an HttpRequest (a Smithy type).
  const httpRequest = convertRequest(req);

  // Call the service handler, which will route the request to the
  // implementation and then serialize the response to an HttpResponse (Smithy).
  const httpResponse = await serviceHandler.handle(httpRequest, {});

  // Write the HttpResponse to NodeJS http's response expected format.
  writeResponse(httpResponse, res);
});

server.listen(3000);
console.log("Listening on port 3000");
```

## HTTP/2 server for event streams

Bidirectional and input event streams require HTTP/2 for full-duplex
communication. Use Node.js `http2.createServer()` (or `createSecureServer` for
TLS) and handle the `stream` event directly.

The `writeResponse` helper supports `AsyncIterable<Uint8Array>` bodies (used by
event stream responses), automatically piping chunks to the response.

```typescript
import { createServer } from "node:http2";
import { HttpRequest } from "@smithy/core/protocols";

// Generated server SDK handler — supports event stream operations.
import { MyServiceHandler } from "@example/my-service-server";

const serviceHandler = new MyServiceHandler({
  handlers: {
    // Output-only stream example.
    async SubscribeToEvents(input) {
      return {
        subscriptionId: `sub-${input.channel}`,
        events: (async function* () {
          for (let i = 0; i < 100; i++) {
            yield { notification: { topic: input.channel, payload: `msg-${i}` } };
            await new Promise((r) => setTimeout(r, 100));
          }
        })(),
      };
    },

    // Bidirectional stream example.
    async Chat(input) {
      return {
        sessionId: `session-${input.sessionId}`,
        messages: (async function* () {
          for await (const msg of input.messages) {
            yield { reply: { text: `Echo: ${msg.message?.text}` } };
          }
        })(),
      };
    },

    // ... other operation handlers
  },
});

const server = createServer();

server.on("stream", async (stream, headers) => {
  stream.on("error", () => {}); // Prevent unhandled error crashes.

  // Extract standard headers (skip HTTP/2 pseudo-headers).
  const reqHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!key.startsWith(":") && value !== undefined) {
      reqHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
    }
  }

  const httpRequest = new HttpRequest({
    method: headers[":method"] as string,
    path: headers[":path"] as string,
    headers: reqHeaders,
    body: stream, // The H2 stream IS the request body (AsyncIterable).
  });

  try {
    const httpResponse = await serviceHandler.handle(httpRequest, {});

    // Send response headers.
    const responseHeaders: Record<string, string | number> = {
      ":status": httpResponse.statusCode,
    };
    for (const [key, value] of Object.entries(httpResponse.headers)) {
      responseHeaders[key] = value;
    }
    stream.respond(responseHeaders);

    // Write response body — may be an async iterable (event stream).
    if (httpResponse.body) {
      if (typeof httpResponse.body[Symbol.asyncIterator] === "function") {
        for await (const chunk of httpResponse.body) {
          stream.write(chunk);
        }
        stream.end();
      } else {
        stream.end(httpResponse.body);
      }
    } else {
      stream.end();
    }
  } catch (err) {
    if (!stream.destroyed) {
      stream.respond({ ":status": 500 });
      stream.end();
    }
  }
});

server.listen(3000);
console.log("HTTP/2 server listening on port 3000");
```
