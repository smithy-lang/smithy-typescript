import { type TypeRegistry, NormalizedSchema, op } from "@smithy/core/schema";
import { dateToUtcString, generateIdempotencyToken, LazyJsonString, quoteHeader } from "@smithy/core/serde";
import { streamCollector } from "@smithy/node-http-handler";
import { HttpResponse } from "@smithy/protocol-http";
import type {
  $Schema,
  $ShapeSerializer,
  Codec,
  CodecSettings,
  HandlerExecutionContext,
  HttpResponse as IHttpResponse,
  ListSchemaModifier,
  MapSchemaModifier,
  MetadataBearer,
  NumericSchema,
  OperationSchema,
  ResponseMetadata,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticStructureSchema,
  StringSchema,
  TimestampDateTimeSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";
import { parseUrl } from "@smithy/url-parser";
import { toBase64 } from "@smithy/util-base64";
import { Readable } from "node:stream";
import { describe, expect, test as it } from "vitest";

import { HttpBindingProtocol } from "./HttpBindingProtocol";
import { determineTimestampFormat } from "./serde/determineTimestampFormat";
import { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";
import { SerdeContext } from "./SerdeContext";

describe(HttpBindingProtocol.name, () => {
  class ToStringTestShapeSerializer extends SerdeContext implements $ShapeSerializer<string> {
    private stringBuffer = "";

    public constructor(private settings: CodecSettings) {
      super();
    }

    public write(schema: $Schema, value: unknown): void {
      const ns = NormalizedSchema.of(schema);
      switch (typeof value) {
        case "object":
          if (value === null) {
            this.stringBuffer = "null";
            return;
          }
          if (ns.isTimestampSchema()) {
            if (!(value instanceof Date)) {
              throw new Error(
                `@smithy/core/protocols - received non-Date value ${value} when schema expected Date in ${ns.getName(
                  true
                )}`
              );
            }
            const format = determineTimestampFormat(ns, this.settings);
            switch (format) {
              case 5 satisfies TimestampDateTimeSchema:
                this.stringBuffer = value.toISOString().replace(".000Z", "Z");
                break;
              case 6 satisfies TimestampHttpDateSchema:
                this.stringBuffer = dateToUtcString(value);
                break;
              case 7 satisfies TimestampEpochSecondsSchema:
                this.stringBuffer = String(value.getTime() / 1000);
                break;
              default:
                console.warn("Missing timestamp format, using epoch seconds", value);
                this.stringBuffer = String(value.getTime() / 1000);
            }
            return;
          }
          if (ns.isBlobSchema() && "byteLength" in (value as Uint8Array)) {
            this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(value as Uint8Array);
            return;
          }
          if (ns.isListSchema() && Array.isArray(value)) {
            let buffer = "";
            for (const item of value) {
              this.write([ns.getValueSchema(), ns.getMergedTraits()], item);
              const headerItem = this.flush();
              const serialized = ns.getValueSchema().isTimestampSchema() ? headerItem : quoteHeader(headerItem);
              if (buffer !== "") {
                buffer += ", ";
              }
              buffer += serialized;
            }
            this.stringBuffer = buffer;
            return;
          }
          let b = "";
          b += "{";
          const keyValues = [];
          for (const [k, $] of ns.structIterator()) {
            let row = "";
            const v = (value as any)[k];
            if (v != null || $.isIdempotencyToken()) {
              row += `"${k}":"`;
              this.write($, v);
              row += this.stringBuffer;
              this.stringBuffer = "";
              row += `"`;
              keyValues.push(row);
            }
          }
          b += keyValues.join(",");
          b += "}";
          this.stringBuffer = b;
          break;
        case "string":
          const mediaType = ns.getMergedTraits().mediaType;
          let intermediateValue: string | LazyJsonString = value;
          if (mediaType) {
            const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
            if (isJson) {
              intermediateValue = LazyJsonString.from(intermediateValue);
            }
            if (ns.getMergedTraits().httpHeader) {
              this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(intermediateValue.toString());
              return;
            }
          }
          this.stringBuffer = value;
          break;
        default:
          if (ns.isIdempotencyToken()) {
            this.stringBuffer = generateIdempotencyToken();
          } else {
            this.stringBuffer = String(value);
          }
      }
    }

    public flush(): string {
      const buffer = this.stringBuffer;
      this.stringBuffer = "";
      return buffer;
    }
  }

  class StringRestProtocol extends HttpBindingProtocol {
    protected serializer: ShapeSerializer<string | Uint8Array>;
    protected deserializer: ShapeDeserializer<string | Uint8Array>;

    public constructor(
      {
        defaultNamespace = "",
        errorTypeRegistries = [],
      }: {
        defaultNamespace: string;
        errorTypeRegistries?: TypeRegistry[];
      } = {
        defaultNamespace: "",
        errorTypeRegistries: [],
      }
    ) {
      super({
        defaultNamespace,
        errorTypeRegistries,
      });
      const settings: CodecSettings = {
        timestampFormat: {
          useTrait: true,
          default: 7 satisfies TimestampEpochSecondsSchema,
        },
        httpBindings: true,
      };
      this.serializer = new ToStringTestShapeSerializer(settings);
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

  it("should not serialize http-location-bound idempotency tokens into the body", async () => {
    const protocol = new StringRestProtocol();
    const request = await protocol.serializeRequest(
      op(
        "",
        "",
        {
          http: ["GET", "/Operation", 200],
        },
        [
          3,
          "ns",
          "Struct",
          0,
          ["headerToken", "queryToken", "body1", "body2", "bodyToken"],
          [
            [0, { idempotencyToken: 1, httpQuery: "query-token" }],
            [0, { idempotencyToken: 1, httpHeader: "header-token" }],
            0,
            0,
            [0, 0b0000_0100],
          ],
        ] satisfies StaticStructureSchema,
        "unit"
      ),
      {
        headerToken: undefined,
        body1: "text",
        body2: "more text",
        bodyToken: undefined,
      },
      {
        endpoint: async () => parseUrl("https://localhost/custom"),
      } as any
    );

    expect(request.headers["header-token"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(request.query?.["query-token"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      body1: "text",
      body2: "more text",
      bodyToken: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    });
    expect(body.headerToken).toBeUndefined();
  });

  it("should discard response bodies for Unit operation outputs, making no attempt to parse them", async () => {
    const protocol = new StringRestProtocol();
    let streamProgress = 0;
    const response = await protocol.deserializeResponse(
      op("", "", {}, "unit", "unit"),
      {
        streamCollector: streamCollector,
      } as any,
      new HttpResponse({
        statusCode: 200,
        headers: {},
        body: Readable.from({
          async *[Symbol.asyncIterator]() {
            yield "@";
            streamProgress = 25;
            yield "#";
            streamProgress = 50;
            yield "$";
            streamProgress = 75;
            yield "%";
            streamProgress = 100;
          },
        }),
      })
    );

    expect(response).toEqual({
      $metadata: {
        cfId: undefined,
        extendedRequestId: undefined,
        httpStatusCode: 200,
        requestId: undefined,
      },
    });

    expect(streamProgress).toBe(100);
  });

  it("should not create undefined fields when deserializing non-http-binding members of an output shape", async () => {
    const protocol = new StringRestProtocol();
    const response = new HttpResponse({
      statusCode: 200,
      headers: {},
      body: Readable.from(JSON.stringify({})),
    });

    const output = (await protocol.deserializeResponse(
      op("", "", 0, "unit", [3, "", "", 0, ["prop", "num"], [0 satisfies StringSchema, 1 satisfies NumericSchema]]),
      {
        streamCollector: streamCollector,
      } as any,
      response
    )) as Partial<MetadataBearer>;

    // Fields not present in response should not exist in output
    expect("prop" in output).toBe(false);
    expect("num" in output).toBe(false);

    // Only $metadata should be present
    const keys = Object.keys(output);
    expect(keys).toEqual(["$metadata"]);
  });

  describe("httpLabel", () => {
    it("should throw an error if an httpLabel is missing", async () => {
      const protocol = new StringRestProtocol();
      await expect(
        protocol.serializeRequest(
          op(
            "ns",
            "operation",
            {
              http: ["GET", "/path/{labelGoesHere}/operation?arg=1", 200],
            },
            [3, "ns", "Struct", 0, ["labelGoesHere"], [[0, { httpLabel: 1 }]]] satisfies StaticStructureSchema,
            "unit"
          ),
          {},
          {
            endpoint: async () => parseUrl("https://localhost"),
          } as any
        )
      ).rejects.toThrow("No value provided for input HTTP label: labelGoesHere.");
    });

    it("should not throw if the request path does not contain the missing httpLabel (edge case)", async () => {
      const protocol = new StringRestProtocol();
      await protocol.serializeRequest(
        op(
          "ns",
          "operation",
          {
            http: ["GET", "/path/operation?arg=1", 200],
          },
          [3, "ns", "Struct", 0, ["labelGoesHere"], [[0, { httpLabel: 1 }]]] satisfies StaticStructureSchema,
          "unit"
        ),
        {},
        {
          endpoint: async () => parseUrl("https://localhost"),
        } as any
      );
    });
  });
});
