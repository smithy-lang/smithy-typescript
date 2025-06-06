import { map, SCHEMA, struct } from "@smithy/core/schema";
import { HandlerExecutionContext, HttpResponse as IHttpResponse, Schema, SerdeFunctions } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { HttpProtocol } from "./HttpProtocol";
import { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";

describe(HttpProtocol.name, () => {
  it("can deserialize a prefix header binding and header binding from the same header", async () => {
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
      prefixHeaders: {
        header: "header-value",
      },
      header: "header-value",
    });
  });
});
