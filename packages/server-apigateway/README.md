# `@smithy-typescript/server-apigateway`

This package provides glue code to enable using a server SDK inside of
API Gateway Lambda functions.

## Alpha software

The Smithy TypeScript Server SDK is an alpha release, and breaking changes may happen between
minor versions in the `0.x` range.

## Usage

### API Gateway v2 (HTTP API)

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { convertEvent, convertVersion2Response } from "@smithy/server-apigateway";

// A SchemaServiceHandler or generated service handler instance.
const serviceHandler = ...

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  // Convert API Gateway's Lambda event to an HttpRequest.
  const httpRequest = convertEvent(event);

  // Call the service handler, which will route the request to the
  // operation implementation and serialize the response to an HttpResponse.
  const httpResponse = await serviceHandler.handle(httpRequest, {});

  // Convert the HttpResponse to API Gateway's expected format.
  return convertVersion2Response(httpResponse);
};
```

### API Gateway v1 (REST API)

```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { convertEvent, convertVersion1Response } from "@smithy/server-apigateway";

// A SchemaServiceHandler or generated service handler instance.
const serviceHandler = ...

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const httpRequest = convertEvent(event);
  const httpResponse = await serviceHandler.handle(httpRequest, {});
  return convertVersion1Response(httpResponse);
};
```
