import { op, SCHEMA, struct } from "@smithy/core/schema";
import { HttpResponse } from "@smithy/protocol-http";
import {
  Codec,
  CodecSettings,
  HandlerExecutionContext,
  HttpResponse as IHttpResponse,
  OperationSchema,
  ResponseMetadata,
  ShapeDeserializer,
  ShapeSerializer,
} from "@smithy/types";
import { parseUrl } from "@smithy/url-parser/src";
import { describe, expect, test as it } from "vitest";

import { HttpBindingProtocol } from "./HttpBindingProtocol";
import { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";
import { ToStringShapeSerializer } from "./serde/ToStringShapeSerializer";

describe(HttpBindingProtocol.name, () => {
  class StringRestProtocol extends HttpBindingProtocol {
    protected serializer: ShapeSerializer<string | Uint8Array>;
    protected deserializer: ShapeDeserializer<string | Uint8Array>;

    public constructor() {
      super({
        defaultNamespace: "",
      });
      const settings: CodecSettings = {
        timestampFormat: {
          useTrait: true,
          default: SCHEMA.TIMESTAMP_EPOCH_SECONDS,
        },
        httpBindings: true,
      };
      this.serializer = new ToStringShapeSerializer(settings);
      this.deserializer = new FromStringShapeDeserializer(settings);
    }

    public getShapeId(): string {
      throw new Error("Method not implemented.");
    }
    public getPayloadCodec(): Codec<any, any> {
      throw new Error("Method not implemented.");
    }
    protected handleError(
      operationSchema: OperationSchema,
      context: HandlerExecutionContext,
      response: IHttpResponse,
      dataObject: any,
      metadata: ResponseMetadata
    ): Promise<never> {
      void [operationSchema, context, response, dataObject, metadata];
      throw new Error("Method not implemented.");
    }
  }

  it("should deserialize timestamp list with unescaped commas", async () => {
    const response = new HttpResponse({
      statusCode: 200,
      headers: {
        "x-timestamplist": "Mon, 16 Dec 2019 23:48:18 GMT, Mon, 16 Dec 2019 23:48:18 GMT",
      },
    });

    const protocol = new StringRestProtocol();
    const output = await protocol.deserializeResponse(
      op(
        "",
        "",
        0,
        "unit",
        struct(
          "",
          "",
          0,
          ["timestampList"],
          [
            [
              SCHEMA.LIST_MODIFIER | SCHEMA.TIMESTAMP_DEFAULT,
              {
                httpHeader: "x-timestamplist",
              },
            ],
          ]
        )
      ),
      {} as any,
      response
    );
    delete output.$metadata;
    expect(output).toEqual({
      timestampList: [new Date("2019-12-16T23:48:18.000Z"), new Date("2019-12-16T23:48:18.000Z")],
    });
  });

  it("should deserialize all headers when httpPrefixHeaders value is empty string", async () => {
    const response = new HttpResponse({
      statusCode: 200,
      headers: {
        "x-tents": "tents",
        hello: "Hello",
      },
    });

    const protocol = new StringRestProtocol();
    const output = await protocol.deserializeResponse(
      op(
        "",
        "",
        0,
        "unit",
        struct(
          "",
          "",
          0,
          ["httpPrefixHeaders"],
          [
            [
              SCHEMA.MAP_MODIFIER | SCHEMA.STRING,
              {
                httpPrefixHeaders: "",
              },
            ],
          ]
        )
      ),
      {} as any,
      response
    );
    delete output.$metadata;
    expect(output).toEqual({
      httpPrefixHeaders: {
        "x-tents": "tents",
        hello: "Hello",
      },
    });
  });

  it("should serialize custom paths in context-provided endpoint", async () => {
    const protocol = new StringRestProtocol();
    const request = await protocol.serializeRequest(
      op(
        "",
        "",
        {
          http: ["GET", "/Operation", 200],
        },
        "unit",
        "unit"
      ),
      {},
      {
        endpoint: async () => parseUrl("https://localhost/custom"),
      } as any
    );
    expect(request.path).toEqual("/custom/Operation");
  });
});
