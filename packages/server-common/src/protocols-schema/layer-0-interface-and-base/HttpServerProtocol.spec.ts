import { beforeEach, describe, expect, it } from "vitest";
import { HttpServerProtocol } from "./HttpServerProtocol";
import { NotAcceptableException, ServiceException, UnsupportedMediaTypeException } from "../../errors";
import type { HttpRequest as IHttpRequest, HttpResponse as IHttpResponse, $OperationSchema } from "@smithy/types";

/**
 * Concrete subclass for testing abstract HttpServerProtocol.
 */
class TestProtocol extends HttpServerProtocol {
  public serializeSuccessCalled = false;
  public serializeErrorCalled = false;

  protected serializer: any = {
    write(_schema: any, _value: any) {},
    flush: () => new Uint8Array([1, 2, 3]),
    setSerdeContext() {},
  };
  protected deserializer: any = {
    read: () => ({}),
    setSerdeContext() {},
  };

  constructor() {
    super({ defaultNamespace: "test.namespace" });
  }

  public getShapeId(): string {
    return "test#Protocol";
  }

  protected getDefaultContentType(): string {
    return "application/json";
  }

  public async deserializeRequest<Input extends object>(): Promise<Input> {
    return {} as Input;
  }

  protected async serializeSuccess(): Promise<IHttpResponse> {
    this.serializeSuccessCalled = true;
    return { statusCode: 200, headers: {} } as any;
  }

  protected async serializeError(): Promise<IHttpResponse> {
    this.serializeErrorCalled = true;
    return { statusCode: 500, headers: {} } as any;
  }

  // Expose protected methods for testing.
  public testValidateContentType(request: IHttpRequest) {
    return this.validateContentType(request);
  }

  public testValidateAccept(request: IHttpRequest) {
    return this.validateAccept(request);
  }

  public testGetHeaderValue(request: IHttpRequest, name: string) {
    return this.getHeaderValue(request, name);
  }
}

function makeRequest(headers: Record<string, string> = {}): IHttpRequest {
  return { method: "POST", path: "/", headers, query: {} } as any;
}

describe("HttpServerProtocol", () => {
  let protocol: TestProtocol;

  beforeEach(() => {
    protocol = new TestProtocol();
  });

  describe("getHeaderValue", () => {
    it("finds header case-insensitively", () => {
      const request = makeRequest({ "Content-Type": "application/json" });
      expect(protocol.testGetHeaderValue(request, "content-type")).toBe("application/json");
    });

    it("returns undefined for missing header", () => {
      const request = makeRequest({});
      expect(protocol.testGetHeaderValue(request, "content-type")).toBeUndefined();
    });

    it("finds header regardless of header key casing", () => {
      const request = makeRequest({ "X-Custom-Header": "value" });
      expect(protocol.testGetHeaderValue(request, "x-custom-header")).toBe("value");
    });
  });

  describe("validateContentType", () => {
    it("allows matching content type", () => {
      const request = makeRequest({ "content-type": "application/json" });
      expect(() => protocol.testValidateContentType(request)).not.toThrow();
    });

    it("allows missing content type (e.g. no body)", () => {
      const request = makeRequest({});
      expect(() => protocol.testValidateContentType(request)).not.toThrow();
    });

    it("throws UnsupportedMediaTypeException for wrong content type", () => {
      const request = makeRequest({ "content-type": "text/xml" });
      expect(() => protocol.testValidateContentType(request)).toThrow(UnsupportedMediaTypeException);
    });

    it("matches Content-Type case-insensitively in header name", () => {
      const request = makeRequest({ "Content-Type": "text/plain" });
      expect(() => protocol.testValidateContentType(request)).toThrow(UnsupportedMediaTypeException);
    });
  });

  describe("validateAccept", () => {
    it("allows matching accept header", () => {
      const request = makeRequest({ accept: "application/json" });
      expect(() => protocol.testValidateAccept(request)).not.toThrow();
    });

    it("allows missing accept header", () => {
      const request = makeRequest({});
      expect(() => protocol.testValidateAccept(request)).not.toThrow();
    });

    it("allows wildcard accept (*/*)", () => {
      const request = makeRequest({ accept: "*/*" });
      expect(() => protocol.testValidateAccept(request)).not.toThrow();
    });

    it("allows type wildcard (application/*)", () => {
      const request = makeRequest({ accept: "application/*" });
      expect(() => protocol.testValidateAccept(request)).not.toThrow();
    });

    it("throws NotAcceptableException for incompatible accept", () => {
      const request = makeRequest({ accept: "text/xml" });
      expect(() => protocol.testValidateAccept(request)).toThrow(NotAcceptableException);
    });
  });

  describe("serializeResponse routing", () => {
    const mockContext = {} as any;
    const mockSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;

    it("routes framework exceptions to serializeFrameworkException", async () => {
      const frameworkError = {
        name: "SerializationException",
        statusCode: 400,
        $frameworkError: true,
      };
      const response = await protocol.serializeResponse(mockSchema, mockContext, frameworkError as any);
      // Framework exceptions are handled inline, not via serializeError.
      expect(protocol.serializeErrorCalled).toBe(false);
      expect(protocol.serializeSuccessCalled).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toBe("application/json");
    });

    it("routes ServiceException instances to serializeError", async () => {
      const error = new ServiceException({ name: "NotFound", $fault: "client" });
      await protocol.serializeResponse(mockSchema, mockContext, error as any);
      expect(protocol.serializeErrorCalled).toBe(true);
      expect(protocol.serializeSuccessCalled).toBe(false);
    });

    it("routes objects with $fault to serializeError", async () => {
      const error = { name: "ValidationError", $fault: "client", message: "bad input" };
      await protocol.serializeResponse(mockSchema, mockContext, error as any);
      expect(protocol.serializeErrorCalled).toBe(true);
      expect(protocol.serializeSuccessCalled).toBe(false);
    });

    it("routes normal output to serializeSuccess", async () => {
      const output = { result: "ok" };
      await protocol.serializeResponse(mockSchema, mockContext, output as any);
      expect(protocol.serializeSuccessCalled).toBe(true);
      expect(protocol.serializeErrorCalled).toBe(false);
    });

    it("does not treat nameless objects as errors", async () => {
      const output = { data: 123 };
      await protocol.serializeResponse(mockSchema, mockContext, output as any);
      expect(protocol.serializeSuccessCalled).toBe(true);
    });
  });

  describe("serializeFrameworkException", () => {
    it("includes __type and message in the body", async () => {
      let writtenValue: any;
      protocol["serializer"].write = (_s: any, v: any) => {
        writtenValue = v;
      };

      const error = {
        name: "UnsupportedMediaTypeException",
        statusCode: 415,
        $frameworkError: true,
      };
      const response = await protocol.serializeResponse({} as any, {} as any, error as any);
      expect(response.statusCode).toBe(415);
      expect(writtenValue.__type).toBe("UnsupportedMediaTypeException");
    });
  });
});
