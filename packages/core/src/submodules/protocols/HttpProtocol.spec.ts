import { map, SCHEMA, struct } from "@smithy/core/schema";
import type { HandlerExecutionContext, HttpResponse as IHttpResponse, Schema, SerdeFunctions } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { HttpProtocol } from "./HttpProtocol";
import { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";

describe(HttpProtocol.name, () => {
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
          default: SCHEMA.TIMESTAMP_EPOCH_SECONDS,
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
