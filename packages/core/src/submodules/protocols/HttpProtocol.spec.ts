import { map, op, struct } from "@smithy/core/schema";
import { HttpRequest } from "@smithy/protocol-http";
import type {
  Codec,
  EndpointV2,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  OperationSchema,
  ResponseMetadata,
  Schema,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticStructureSchema,
  TimestampEpochSecondsSchema,
} from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { HttpProtocol } from "./HttpProtocol";
import { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";

class TestHttpProtocol extends HttpProtocol {
  protected serializer: ShapeSerializer<string | Uint8Array> = {} as ShapeSerializer<string | Uint8Array>;
  protected deserializer: ShapeDeserializer<string | Uint8Array> = {} as ShapeDeserializer<string | Uint8Array>;

  public constructor() {
    super({ defaultNamespace: "test" });
  }

  public getShapeId(): string {
    return "test#Test";
  }

  public getPayloadCodec(): Codec<any, any> {
    throw new Error("Method not implemented.");
  }

  public async serializeRequest(): Promise<IHttpRequest> {
    throw new Error("Method not implemented.");
  }

  public async deserializeResponse(): Promise<any> {
    throw new Error("Method not implemented.");
  }

  protected async handleError(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    dataObject: any,
    metadata: ResponseMetadata
  ): Promise<never> {
    throw new Error("Method not implemented.");
  }

  public callSetHostPrefix(request: IHttpRequest, operationSchema: OperationSchema, input: any): void {
    this.setHostPrefix(request, operationSchema, input);
  }
}

describe(HttpProtocol.name, () => {
  describe("setHostPrefix", () => {
    const protocol = new TestHttpProtocol();

    const makeOperationSchema = (hostPrefix: string) =>
      op(
        "",
        "TestOp",
        { endpoint: [hostPrefix] },
        [3, "test", "Input", 0, ["AccountId"], [[0, { hostLabel: 1 }]]] satisfies StaticStructureSchema,
        "unit"
      );

    it("should substitute valid hostLabel into hostname", () => {
      const request = new HttpRequest({ hostname: "api.service.com" });
      const schema = makeOperationSchema("{AccountId}.");
      protocol.callSetHostPrefix(request, schema, { AccountId: "123456789012" });
      expect(request.hostname).toBe("123456789012.api.service.com");
    });

    it("should throw when hostLabel contains invalid characters (slash)", () => {
      const request = new HttpRequest({ hostname: "api.service.com" });
      const schema = makeOperationSchema("{AccountId}.");
      expect(() => protocol.callSetHostPrefix(request, schema, { AccountId: "1234567abc/" })).toThrow(
        "resolved hostname is not a valid hostname"
      );
    });

    it("should throw when hostLabel contains hash character", () => {
      const request = new HttpRequest({ hostname: "api.service.com" });
      const schema = makeOperationSchema("{AccountId}.");
      expect(() => protocol.callSetHostPrefix(request, schema, { AccountId: "987654321/#" })).toThrow(
        "resolved hostname is not a valid hostname"
      );
    });

    it("should throw when hostLabel contains query character", () => {
      const request = new HttpRequest({ hostname: "api.service.com" });
      const schema = makeOperationSchema("{AccountId}.");
      expect(() => protocol.callSetHostPrefix(request, schema, { AccountId: "12345678/?x=" })).toThrow(
        "resolved hostname is not a valid hostname"
      );
    });

    it("should throw when hostLabel contains @ character", () => {
      const request = new HttpRequest({ hostname: "api.service.com" });
      const schema = makeOperationSchema("{AccountId}.");
      expect(() => protocol.callSetHostPrefix(request, schema, { AccountId: "123456789/x@" })).toThrow(
        "resolved hostname is not a valid hostname"
      );
    });

    it("should throw when hostLabel input is not a string", () => {
      const request = new HttpRequest({ hostname: "api.service.com" });
      const schema = makeOperationSchema("{AccountId}.");
      expect(() => protocol.callSetHostPrefix(request, schema, { AccountId: 123 })).toThrow(
        "must be a string as hostLabel"
      );
    });

    it("should not set host prefix when disableHostPrefix is true", () => {
      const p = new TestHttpProtocol();
      (p as any).serdeContext = { disableHostPrefix: true };
      const request = new HttpRequest({ hostname: "api.service.com" });
      const schema = makeOperationSchema("{AccountId}.");
      p.callSetHostPrefix(request, schema, { AccountId: "abc/#" });
      expect(request.hostname).toBe("api.service.com");
    });
  });

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
