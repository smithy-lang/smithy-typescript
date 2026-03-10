import { map, struct } from "@smithy/core/schema";
import { HttpRequest } from "@smithy/protocol-http";
import type {
  EndpointV2,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  Schema,
  SerdeFunctions,
  TimestampEpochSecondsSchema,
} from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { HttpProtocol } from "./HttpProtocol";
import { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";

describe(HttpProtocol.name, () => {
  describe("updateServiceEndpoint", () => {
    it("applies endpoint-resolved headers to the request", () => {
      const request = new HttpRequest({ headers: { "content-type": "application/json" } });
      const endpoint: EndpointV2 = {
        url: new URL("https://api.example.com/"),
        headers: {
          "x-api-key": ["my-api-key"],
          "x-custom-header": ["value1", "value2"],
        },
      };

      HttpProtocol.prototype.updateServiceEndpoint(request, endpoint);

      expect(request.headers).toEqual({
        "content-type": "application/json",
        "x-api-key": "my-api-key",
        "x-custom-header": "value1, value2",
      });
    });

    it("handles endpoint with no headers", () => {
      const request = new HttpRequest({ headers: { "content-type": "application/json" } });
      const endpoint: EndpointV2 = {
        url: new URL("https://api.example.com/"),
      };

      HttpProtocol.prototype.updateServiceEndpoint(request, endpoint);

      expect(request.headers).toEqual({ "content-type": "application/json" });
    });
  });

  it("ignores http bindings (only HttpBindingProtocol uses them)", async () => {
    type TestSignature = (
      schema: Schema,
      context: HandlerExecutionContext & SerdeFunctions,
      response: IHttpResponse,
      dataObject: any
    ) => Promise<string[]>;
    const deserializeHttpMessage = ((HttpProtocol.prototype as any).deserializeHttpMessage as TestSignature).bind({
      deserializer: new FromStringShapeDeserializer({
        httpBindings: true,
        timestampFormat: {
          useTrait: true,
          default: 7 satisfies TimestampEpochSecondsSchema,
        },
      }),
    });
    const httpResponse: IHttpResponse = {
      statusCode: 200,
      headers: {
        "my-header": "header-value",
      },
    };

    const dataObject = {};
    await deserializeHttpMessage(
      struct(
        "",
        "Struct",
        0,
        ["prefixHeaders", "header"],
        [
          [map("", "Map", 0, 0, 0), { httpPrefixHeaders: "my-" }],
          [0, { httpHeader: "my-header" }],
        ]
      ),
      {} as any,
      httpResponse,
      dataObject
    );
    expect(dataObject).toEqual({
      // headers were ignored
    });
  });
});
