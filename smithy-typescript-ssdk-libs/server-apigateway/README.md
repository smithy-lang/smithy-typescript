# smithy-typescript/server-apigateway

This package provides glue code to enable using a server sdk inside of
apigateway.

## Usage

### Example

```typescript
import { HttpRequest} from "@aws-sdk/protocol-http";
import { GreetingService as __GreetingService, SayHelloInput, SayHelloOutput, getGreetingServiceHandler } from "@greeting-service/service-greeting";
import { convertEvent, convertResponse } from "@aws-smithy/server-apigateway";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
​
class GreetingService implements __GreetingService {
    SayHello(input: SayHelloInput, request: HttpRequest) : SayHelloOutput {
        return {
            greeting: `Hello ${input.name}! How is ${input.city}?`
        }
    }
}
​
const serviceHandler = getGreetingServiceHandler(new GreetingService());
​
export const lambdaHandler: APIGatewayProxyHandlerV2 = async (
    event: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyResultV2> => {

    console.log(`Received event: ${JSON.stringify(event)}`);

    // Convert apigateway's lambda event to an HttpRequest.
    const convertedEvent = convertEvent(event);

    // Call the service handler, which will route the request to the GreetingService
    // implementation and then serialize the response to an HttpResponse.
    let rawResponse = await serviceHandler.handle(convertedEvent);

    // Convert the HttpResponse to apigateway's expected format.
​    const convertedResponse = convertResponse(rawResponse);
    console.log(`Returning response: ${JSON.stringify(convertedResponse)}`)
​
    return convertedResponse;
}
```
