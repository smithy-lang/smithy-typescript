import { NormalizedSchema, op } from "@smithy/core/schema";
import type {
  $Schema,
  $ShapeSerializer,
  Codec,
  CodecSettings,
  HandlerExecutionContext,
  HttpResponse as IHttpResponse,
  OperationSchema,
  ResponseMetadata,
  ShapeDeserializer,
  ShapeSerializer,
  StaticStructureSchema,
} from "@smithy/types";
import { parseUrl } from "@smithy/url-parser";
import { describe, expect, test as it } from "vitest";

import { RpcProtocol } from "./RpcProtocol";
import { SerdeContext } from "./SerdeContext";
import { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";

describe(RpcProtocol.name, () => {
  /**
   * Minimal serializer that records what schema+value pairs were written,
   * and produces a JSON string on flush.
   */
  class SpyShapeSerializer extends SerdeContext implements $ShapeSerializer<string> {
    public writeCalls: Array<{ schema: $Schema; value: unknown }> = [];
    private buffer = "";

    public constructor(private settings: CodecSettings) {
      super();
    }

    public write(schema: $Schema, value: unknown): void {
      this.writeCalls.push({ schema, value });
      const ns = NormalizedSchema.of(schema);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const entries: string[] = [];
        for (const [k, memberSchema] of ns.structIterator()) {
          const v = (value as any)[k];
          if (v != null) {
            entries.push(`"${k}":"${v}"`);
          }
        }
        this.buffer = `{${entries.join(",")}}`;
      } else {
        this.buffer = JSON.stringify(value);
      }
    }

    public flush(): string {
      const result = this.buffer;
      this.buffer = "";
      return result;
    }
  }

  class TestRpcProtocol extends RpcProtocol {
    protected serializer: ShapeSerializer<string | Uint8Array>;
    protected deserializer: ShapeDeserializer<string | Uint8Array>;
    public spySerializer: SpyShapeSerializer;

    public constructor() {
      super({
        defaultNamespace: "",
        errorTypeRegistries: [],
      });
      const settings: CodecSettings = {
        timestampFormat: { useTrait: true, default: 7 },
        httpBindings: false,
      };
      this.spySerializer = new SpyShapeSerializer(settings);
      this.serializer = this.spySerializer;
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

  it("should not mutate the caller's input object", async () => {
    const protocol = new TestRpcProtocol();
    const input = Object.freeze({
      fieldA: "hello",
      fieldB: "world",
    });

    const request = await protocol.serializeRequest(
      op("", "", 0, [3, "ns", "Struct", 0, ["fieldA", "fieldB"], [0, 0]] satisfies StaticStructureSchema, "unit"),
      input,
      {
        endpoint: async () => parseUrl("https://localhost"),
      } as any
    );

    // The serializer received the full input
    const body = JSON.parse(request.body);
    expect(body).toEqual({ fieldA: "hello", fieldB: "world" });

    // Original input is untouched
    expect(input.fieldA).toBe("hello");
    expect(input.fieldB).toBe("world");
  });

  it("should pass the original input reference to serializer.write (no spread copy)", async () => {
    const protocol = new TestRpcProtocol();
    const input = { fieldA: "value" };

    await protocol.serializeRequest(
      op("", "", 0, [3, "ns", "Struct", 0, ["fieldA"], [0]] satisfies StaticStructureSchema, "unit"),
      input,
      {
        endpoint: async () => parseUrl("https://localhost"),
      } as any
    );

    // The serializer should have received the exact same object reference
    expect(protocol.spySerializer.writeCalls).toHaveLength(1);
    expect(protocol.spySerializer.writeCalls[0].value).toBe(input);
  });

  it("should handle null/undefined input without throwing", async () => {
    const protocol = new TestRpcProtocol();

    const request = await protocol.serializeRequest(
      op("", "", 0, "unit", "unit"),
      null as any,
      {
        endpoint: async () => parseUrl("https://localhost"),
      } as any
    );

    expect(request.body).toEqual("{}");
    expect(request.method).toBe("POST");
  });

  it("considers non-object inputs to be equivalent to empty objects", async () => {
    const protocol = new TestRpcProtocol();

    for (const input of [null, undefined, 5, false, "hello", "{}"]) {
      const request = await protocol.serializeRequest(
        op("", "", {}, [3, "ns", "Struct", 0, ["a", "b", "c"], [0, 0, 0]] satisfies StaticStructureSchema, "unit"),
        input as any,
        {
          endpoint: async () => parseUrl("https://localhost"),
        } as any
      );

      expect(request.path).toEqual("/");
      expect(request.body).toEqual("{}");
    }
  });
});
