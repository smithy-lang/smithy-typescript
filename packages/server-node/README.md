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
