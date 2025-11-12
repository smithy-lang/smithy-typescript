import { op } from "@smithy/core/schema";
import { HttpResponse } from "@smithy/protocol-http";
import type {
  $Schema,
  Codec,
  CodecSettings,
  HandlerExecutionContext,
  HttpResponse as IHttpResponse,
  ListSchemaModifier,
  MapSchemaModifier,
  MetadataBearer,
  OperationSchema,
  ResponseMetadata,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticStructureSchema,
  StringSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
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
          default: 7 satisfies TimestampEpochSecondsSchema,
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
        "x-timestamplist": "Mon, 16 Nov 2019 23:48:18 GMT, Mon, 16 Dec 2019 23:48:18 GMT",
      },
    });

    const protocol = new StringRestProtocol();
    const output = (await protocol.deserializeResponse(
      op("", "", 0, "unit", [
        3,
        "",
        "",
        0,
        ["timestampList"],
        [
          [
            (64 satisfies ListSchemaModifier) | (4 satisfies TimestampDefaultSchema),
            {
              httpHeader: "x-timestamplist",
            },
          ],
        ],
      ]),
      {} as any,
      response
    )) as Partial<MetadataBearer>;
    delete output.$metadata;
    expect(output).toEqual({
      timestampList: [new Date("2019-11-16T23:48:18.000Z"), new Date("2019-12-16T23:48:18.000Z")],
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
    const output = (await protocol.deserializeResponse(
      op("", "", 0, "unit", [
        3,
        "",
        "",
        0,
        ["httpPrefixHeaders"],
        [
          [
            (128 satisfies MapSchemaModifier) | (0 satisfies StringSchema),
            {
              httpPrefixHeaders: "",
            },
          ],
        ],
      ]),
      {} as any,
      response
    )) as Partial<MetadataBearer>;
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

  it("can deserialize a prefix header binding and header binding from the same header", async () => {
    type TestSignature = (
      schema: $Schema,
      context: HandlerExecutionContext & SerdeFunctions,
      response: IHttpResponse,
      dataObject: any
    ) => Promise<string[]>;
    const deserializeHttpMessage = ((StringRestProtocol.prototype as any).deserializeHttpMessage as TestSignature).bind(
      {
        deserializer: new FromStringShapeDeserializer({
          httpBindings: true,
          timestampFormat: {
            useTrait: true,
            default: 7 satisfies TimestampEpochSecondsSchema,
          },
        }),
      }
    );
    const httpResponse: IHttpResponse = {
      statusCode: 200,
      headers: {
        "my-header": "header-value",
      },
    };

    const dataObject = {};
    await deserializeHttpMessage(
      [
        3,
        "",
        "Struct",
        0,
        ["prefixHeaders", "header"],
        [
          [[2, "", "Map", 0, 0, 0], { httpPrefixHeaders: "my-" }],
          [0, { httpHeader: "my-header" }],
        ],
      ],
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

  it("should fill in undefined idempotency tokens", async () => {
    const protocol = new StringRestProtocol();
    const request = await protocol.serializeRequest(
      op(
        "",
        "",
        {
          http: ["GET", "/{labelToken}/Operation", 200],
        },
        [
          3,
          "ns",
          "Struct",
          0,
          ["name", "queryToken", "labelToken", "headerToken"],
          [
            0,
            [0, { idempotencyToken: 1, httpQuery: "token" }],
            [0, { idempotencyToken: 1, httpLabel: 1 }],
            [0, { idempotencyToken: 1, httpHeader: "header-token" }],
          ],
        ] satisfies StaticStructureSchema,
        "unit"
      ),
      {
        Name: "my-name",
      },
      {
        endpoint: async () => parseUrl("https://localhost/custom"),
      } as any
    );

    expect(request.query?.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(request.path).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(request.headers?.["header-token"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
