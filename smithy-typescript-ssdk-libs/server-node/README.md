# smithy-typescript/server-node

This package provides glue code to enable using a server sdk with NodeJS.

## Usage

### Example

```typescript
import { createServer, IncomingMessage, ServerResponse } from "http";
import { HttpRequest } from "@smithy/protocol-http";
import {
  GreetingService as __GreetingService,
  SayHelloInput,
  SayHelloOutput,
  getGreetingServiceHandler,
} from "@greeting-service/service-greeting";
import { convertEvent, convertResponse } from "@aws-smithy/server-node";
class GreetingService implements __GreetingService {
  SayHello(input: SayHelloInput, request: HttpRequest): SayHelloOutput {
    return {
      greeting: `Hello ${input.name}! How is ${input.city}?`,
    };
  }
}
const serviceHandler = getGreetingServiceHandler(new GreetingService());

const server = createServer(async function (
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage> & { req: IncomingMessage }
) {
  // Convert NodeJS's http request to an HttpRequest.
  const httpRequest = convertRequest(req);

  // Call the service handler, which will route the request to the GreetingService
  // implementation and then serialize the response to an HttpResponse.
  const httpResponse = await serviceHandler.handle(httpRequest);

  // Write the HttpResponse to NodeJS http's response expected format.
  return writeResponse(httpResponse, res);
});

server.listen(3000);
console.error("Listening on port 3000");
```
