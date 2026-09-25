// smithy-typescript generated code
import { nv } from "@smithy/core/serde";
import { expect, test as it } from "vitest";

import { BigDecimalOperationCommand } from "../../src/commands/BigDecimalOperationCommand";
import { BigIntegerOperationCommand } from "../../src/commands/BigIntegerOperationCommand";
import { EmptyInputOutputCommand } from "../../src/commands/EmptyInputOutputCommand";
import { FractionalSecondsCommand } from "../../src/commands/FractionalSecondsCommand";
import { GreetingWithErrorsCommand } from "../../src/commands/GreetingWithErrorsCommand";
import { NoInputOutputCommand } from "../../src/commands/NoInputOutputCommand";
import { OperationWithDefaultsCommand } from "../../src/commands/OperationWithDefaultsCommand";
import { OptionalInputOutputCommand } from "../../src/commands/OptionalInputOutputCommand";
import { RecursiveShapesCommand } from "../../src/commands/RecursiveShapesCommand";
import { RpcV2JsonDenseMapsCommand } from "../../src/commands/RpcV2JsonDenseMapsCommand";
import { RpcV2JsonListsCommand } from "../../src/commands/RpcV2JsonListsCommand";
import { RpcV2JsonSparseMapsCommand } from "../../src/commands/RpcV2JsonSparseMapsCommand";
import { SimpleScalarPropertiesCommand } from "../../src/commands/SimpleScalarPropertiesCommand";
import { SparseNullsOperationCommand } from "../../src/commands/SparseNullsOperationCommand";
import { TimestampFormatIgnoredCommand } from "../../src/commands/TimestampFormatIgnoredCommand";
import { RpcV2JsonProtocolClient } from "../../src/RpcV2JsonProtocolClient";
import { Readable } from "node:stream";
import { HttpRequest, HttpResponse, type HttpHandler } from "@smithy/core/protocols";
import type { Endpoint, HeaderBag, HttpHandlerOptions } from "@smithy/types";

/**
 * Throws an expected exception that contains the serialized request.
 */
class EXPECTED_REQUEST_SERIALIZATION_ERROR extends Error {
  constructor(readonly request: HttpRequest) {
    super();
  }
}

/**
 * Throws an EXPECTED_REQUEST_SERIALIZATION_ERROR error before sending a
 * request. The thrown exception contains the serialized request.
 */
class RequestSerializationTestHandler implements HttpHandler {
  handle(request: HttpRequest, options?: HttpHandlerOptions): Promise<{ response: HttpResponse }> {
    return Promise.reject(new EXPECTED_REQUEST_SERIALIZATION_ERROR(request));
  }
  updateHttpClientConfig(key: never, value: never): void {}
  httpHandlerConfigs() {
    return {};
  }
}

/**
 * Returns a resolved Promise of the specified response contents.
 */
class ResponseDeserializationTestHandler implements HttpHandler {
  isSuccess: boolean;
  code: number;
  headers: HeaderBag;
  body: string | Uint8Array;
  isBase64Body: boolean;

  constructor(isSuccess: boolean, code: number, headers?: HeaderBag, body?: string) {
    this.isSuccess = isSuccess;
    this.code = code;
    if (headers === undefined) {
      this.headers = {};
    } else {
      this.headers = headers;
    }
    if (body === undefined) {
      body = "";
    }
    this.body = body;
    this.isBase64Body = String(body).length > 0 && Buffer.from(String(body), "base64").toString("base64") === body;
  }

  handle(request: HttpRequest, options?: HttpHandlerOptions): Promise<{ response: HttpResponse }> {
    return Promise.resolve({
      response: new HttpResponse({
        statusCode: this.code,
        headers: this.headers,
        body: this.isBase64Body ? toBytes(this.body as string) : Readable.from([this.body]),
      }),
    });
  }

  updateHttpClientConfig(key: never, value: never): void {}

  httpHandlerConfigs() {
    return {};
  }
}

interface comparableParts {
  [key: string]: string;
}

/**
 * Generates a standard map of un-equal values given input parts.
 */
const compareParts = (expectedParts: comparableParts, generatedParts: comparableParts) => {
  const unequalParts: any = {};
  Object.keys(expectedParts).forEach((key) => {
    if (generatedParts[key] === undefined) {
      unequalParts[key] = { exp: expectedParts[key], gen: undefined };
    } else if (!equivalentContents(expectedParts[key], generatedParts[key])) {
      unequalParts[key] = { exp: expectedParts[key], gen: generatedParts[key] };
    }
  });

  Object.keys(generatedParts).forEach((key) => {
    if (expectedParts[key] === undefined) {
      unequalParts[key] = { exp: undefined, gen: generatedParts[key] };
    }
  });

  if (Object.keys(unequalParts).length !== 0) {
    return unequalParts;
  }
  return undefined;
};

/**
 * Compares all types for equivalent contents, doing nested
 * equality checks based on non-`$metadata`
 * properties that have defined values.
 */
const equivalentContents = (expected: any, generated: any): boolean => {
  if (typeof (global as any).expect === "function") {
    expect(normalizeByteArrayType(generated)).toEqual(normalizeByteArrayType(expected));
    return true;
  }

  let localExpected = expected;

  // Short circuit on equality.
  if (localExpected == generated) {
    return true;
  }

  if (typeof expected !== "object") {
    return expected === generated;
  }

  // If a test fails with an issue in the below 6 lines, it's likely
  // due to an issue in the nestedness or existence of the property
  // being compared.
  delete localExpected["$metadata"];
  delete generated["$metadata"];
  Object.keys(localExpected).forEach((key) => localExpected[key] === undefined && delete localExpected[key]);
  Object.keys(generated).forEach((key) => generated[key] === undefined && delete generated[key]);

  const expectedProperties = Object.getOwnPropertyNames(localExpected);
  const generatedProperties = Object.getOwnPropertyNames(generated);

  // Short circuit on different property counts.
  if (expectedProperties.length != generatedProperties.length) {
    return false;
  }

  // Compare properties directly.
  for (var index = 0; index < expectedProperties.length; index++) {
    const propertyName = expectedProperties[index];
    if (!equivalentContents(localExpected[propertyName], generated[propertyName])) {
      return false;
    }
  }

  return true;
};

const clientParams = {
  region: "us-west-2",
  credentials: { accessKeyId: "key", secretAccessKey: "secret" },
  apiKey: { apiKey: "apiKey" },
  endpoint: {
    url: new URL("https://localhost/"),
    headers: {
      "x-default-header": ["default-header-value"],
    },
  },
};

/**
 * A wrapper function that shadows `fail` from jest-jasmine2
 * (jasmine2 was replaced with circus in > v27 as the default test runner)
 */
const fail = (error?: any): never => {
  throw new Error(error);
};

/**
 * Hexadecimal to byteArray.
 */
const toBytes = (hex: string) => {
  return Buffer.from(hex, "base64");
};

function normalizeByteArrayType(data: any) {
  // normalize float32 errors
  if (typeof data === "number") {
    const u = new Uint8Array(4);
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    dv.setFloat32(0, data);
    return dv.getFloat32(0);
  }
  if (!data || typeof data !== "object") {
    return data;
  }
  if (data instanceof Uint8Array) {
    return Uint8Array.from(data);
  }
  if (data instanceof String || data instanceof Boolean || data instanceof Number) {
    return data.valueOf();
  }
  const output = {} as any;
  for (const key of Object.getOwnPropertyNames(data)) {
    output[key] = normalizeByteArrayType(data[key]);
  }
  return output;
}

/**
 * Serializes a simple big decimal value as a JSON string to preserve precision.
 */
it("RpcV2JsonRequestBigDecimalSimpleValue:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new BigDecimalOperationCommand(
    {
      value: nv("1.5"),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/BigDecimalOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"value\": \"1.5\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes a big decimal value that exceeds double precision in the decimal
 * portion. Implementations use JSON strings to preserve this precision.
 */
it("RpcV2JsonRequestBigDecimalHighPrecision:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new BigDecimalOperationCommand(
    {
      value: nv("0.100000000000000000000001"),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/BigDecimalOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"value\": \"0.100000000000000000000001\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes a negative big decimal value that exceeds double precision in
 * the decimal portion. Implementations use JSON strings to preserve this
 * precision.
 */
it("RpcV2JsonRequestBigDecimalNegativeHighPrecision:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new BigDecimalOperationCommand(
    {
      value: nv("-0.100000000000000000000001"),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/BigDecimalOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"value\": \"-0.100000000000000000000001\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes a big decimal value that exceeds double precision in the integer
 * portion. Implementations use JSON strings to preserve this precision.
 */
it("RpcV2JsonRequestBigDecimalLargeWithFraction:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new BigDecimalOperationCommand(
    {
      value: nv("100000000000000000000001.0"),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/BigDecimalOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"value\": \"100000000000000000000001.0\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes a simple big decimal value as a JSON string to preserve precision.
 */
it("RpcV2JsonResponseBigDecimalSimpleValue:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "value": "1.5"
      }`
    ),
  });

  const params: any = {};
  const command = new BigDecimalOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      value: nv("1.5"),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes a big decimal value that exceeds double precision in the decimal
 * portion. Implementations use JSON strings to preserve this precision.
 */
it("RpcV2JsonResponseBigDecimalHighPrecision:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "value": "0.100000000000000000000001"
      }`
    ),
  });

  const params: any = {};
  const command = new BigDecimalOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      value: nv("0.100000000000000000000001"),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes a negative big decimal value that exceeds double precision in
 * the decimal portion. Implementations use JSON strings to preserve this
 * precision.
 */
it("RpcV2JsonResponseBigDecimalNegativeHighPrecision:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "value": "-0.100000000000000000000001"
      }`
    ),
  });

  const params: any = {};
  const command = new BigDecimalOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      value: nv("-0.100000000000000000000001"),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes a big decimal value that exceeds double precision in the integer
 * portion. Implementations use JSON strings to preserve this precision.
 */
it("RpcV2JsonResponseBigDecimalLargeWithFraction:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "value": "100000000000000000000001.0"
      }`
    ),
  });

  const params: any = {};
  const command = new BigDecimalOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      value: nv("100000000000000000000001.0"),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes a simple big integer value as a JSON string to preserve precision.
 */
it("RpcV2JsonRequestBigIntegerSimpleValue:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new BigIntegerOperationCommand(
    {
      value: BigInt("42"),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/BigIntegerOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"value\": \"42\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes a big integer value that exceeds the precision of a long.
 * Implementations use JSON strings to preserve this precision.
 */
it("RpcV2JsonRequestBigIntegerExceedingLongRange:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new BigIntegerOperationCommand(
    {
      value: BigInt("9223372036854775808"),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/BigIntegerOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"value\": \"9223372036854775808\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes a negative big integer value that exceeds the precision of a long.
 * Implementations use JSON strings to preserve this precision.
 */
it("RpcV2JsonRequestBigIntegerNegativeLargeValue:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new BigIntegerOperationCommand(
    {
      value: BigInt("-9223372036854775809"),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/BigIntegerOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"value\": \"-9223372036854775809\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes a simple big integer value as a JSON string to preserve precision.
 */
it("RpcV2JsonResponseBigIntegerSimpleValue:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "value": "42"
      }`
    ),
  });

  const params: any = {};
  const command = new BigIntegerOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      value: BigInt("42"),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes a big integer value that exceeds the precision of a long.
 * Implementations use JSON strings to preserve this precision.
 */
it("RpcV2JsonResponseBigIntegerExceedingLongRange:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "value": "9223372036854775808"
      }`
    ),
  });

  const params: any = {};
  const command = new BigIntegerOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      value: BigInt("9223372036854775808"),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes a negative big integer value that exceeds the precision of a long.
 * Implementations use JSON strings to preserve this precision.
 */
it("RpcV2JsonResponseBigIntegerNegativeLargeValue:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "value": "-9223372036854775809"
      }`
    ),
  });

  const params: any = {};
  const command = new BigIntegerOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      value: BigInt("-9223372036854775809"),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * When Input structure is empty we write an empty JSON object
 */
it("RpcV2JsonRequestEmptyInput:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new EmptyInputOutputCommand(
    {
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/EmptyInputOutput");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(
      r.headers["x-amz-target"],
      `Header key "x-amz-target" should have been undefined in ${JSON.stringify(r.headers)}`
    ).toBeUndefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{}`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * When output structure is empty we write an empty JSON object
 */
it("RpcV2JsonResponseEmptyOutput:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{}`
    ),
  });

  const params: any = {};
  const command = new EmptyInputOutputCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
});

/**
 * When output structure is empty the client should accept an empty body
 */
it("RpcV2JsonResponseEmptyOutputNoBody:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      ``
    ),
  });

  const params: any = {};
  const command = new EmptyInputOutputCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
});

/**
 * Ensures that clients can correctly parse timestamps with fractional seconds
 */
it("RpcV2JsonResponseDateTimeWithFractionalSeconds:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "datetime": 946845296.123
      }`
    ),
  });

  const params: any = {};
  const command = new FractionalSecondsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      datetime: new Date(9.46845296123E8 * 1000),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Parses simple RpcV2 JSON errors
 */
it("RpcV2JsonResponseInvalidGreetingError:Error:GreetingWithErrors", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      false,
      400,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "__type": "smithy.protocoltests.rpcv2Json#InvalidGreeting",
          "Message": "Hi"
      }`
    ),
  });

  const params: any = {};
  const command = new GreetingWithErrorsCommand(params);

  try {
    await client.send(command);
  } catch (err) {
    if (err.name !== "InvalidGreeting") {
      console.log(err);
      fail(`Expected a InvalidGreeting to be thrown, got ${err.name} instead`);
      return;
    }
    const r: any = err;
    expect(r.$metadata.httpStatusCode).toBe(400);
    const paramsToValidate: any = [
      {
        message: "Hi",
      },
    ][0];
    Object.keys(paramsToValidate).forEach((param) => {
      expect(
        r[param],
        `The output field ${param} should have been defined in ${JSON.stringify(
          r,
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
          2
        )}`
      ).toBeDefined();
      expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
    });
    return;
  }
  fail("Expected an exception to be thrown from response");
});

/**
 * Parses a complex error with no message member
 */
it("RpcV2JsonResponseComplexError:Error:GreetingWithErrors", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      false,
      400,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "__type": "smithy.protocoltests.rpcv2Json#ComplexError",
          "TopLevel": "Top level",
          "Nested": {
              "Foo": "bar"
          }
      }`
    ),
  });

  const params: any = {};
  const command = new GreetingWithErrorsCommand(params);

  try {
    await client.send(command);
  } catch (err) {
    if (err.name !== "ComplexError") {
      console.log(err);
      fail(`Expected a ComplexError to be thrown, got ${err.name} instead`);
      return;
    }
    const r: any = err;
    expect(r.$metadata.httpStatusCode).toBe(400);
    const paramsToValidate: any = [
      {
        TopLevel: "Top level",
        Nested: {
          Foo: "bar",
        },
      },
    ][0];
    Object.keys(paramsToValidate).forEach((param) => {
      expect(
        r[param],
        `The output field ${param} should have been defined in ${JSON.stringify(
          r,
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
          2
        )}`
      ).toBeDefined();
      expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
    });
    return;
  }
  fail("Expected an exception to be thrown from response");
});

it("RpcV2JsonResponseEmptyComplexError:Error:GreetingWithErrors", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      false,
      400,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "__type": "smithy.protocoltests.rpcv2Json#ComplexError"
      }`
    ),
  });

  const params: any = {};
  const command = new GreetingWithErrorsCommand(params);

  try {
    await client.send(command);
  } catch (err) {
    if (err.name !== "ComplexError") {
      console.log(err);
      fail(`Expected a ComplexError to be thrown, got ${err.name} instead`);
      return;
    }
    const r: any = err;
    expect(r.$metadata.httpStatusCode).toBe(400);
    return;
  }
  fail("Expected an exception to be thrown from response");
});

/**
 * Body is empty and no Content-Type header if no input
 */
it("RpcV2JsonRequestNoInput:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new NoInputOutputCommand({});
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/NoInputOutput");

    expect(
      r.headers["content-type"],
      `Header key "content-type" should have been undefined in ${JSON.stringify(r.headers)}`
    ).toBeUndefined();
    expect(
      r.headers["x-amz-target"],
      `Header key "x-amz-target" should have been undefined in ${JSON.stringify(r.headers)}`
    ).toBeUndefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(!r.body || r.body === `{}`).toBeTruthy();
  }
});

/**
 * A `Content-Type` header should not be set if the response body is empty.
 */
it("RpcV2JsonResponseNoOutput:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
      },
      ``
    ),
  });

  const params: any = {};
  const command = new NoInputOutputCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
});

/**
 * Clients should accept a JSON empty object if there is no output.
 */
it("RpcV2JsonResponseNoOutputClientAllowsEmptyJsonObject:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{}`
    ),
  });

  const params: any = {};
  const command = new NoInputOutputCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
});

/**
 * Clients should accept an empty body if there is no output and
 * should not raise an error if the `Content-Type` header is set.
 */
it("RpcV2JsonResponseNoOutputClientAllowsEmptyBody:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      ``
    ),
  });

  const params: any = {};
  const command = new NoInputOutputCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
});

/**
 * Client populates default values in input.
 */
it.skip("RpcV2JsonRequestClientPopulatesDefaultValuesInInput:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new OperationWithDefaultsCommand(
    {
      defaults: {
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/OperationWithDefaults");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"defaults\": {
            \"defaultString\": \"hi\",
            \"defaultBoolean\": true,
            \"defaultList\": [],
            \"defaultTimestamp\": 0,
            \"defaultBlob\": \"YWJj\",
            \"defaultByte\": 1,
            \"defaultShort\": 1,
            \"defaultInteger\": 10,
            \"defaultLong\": 100,
            \"defaultFloat\": 1.0,
            \"defaultDouble\": 1.0,
            \"defaultMap\": {},
            \"defaultEnum\": \"FOO\",
            \"defaultIntEnum\": 1,
            \"emptyString\": \"\",
            \"falseBoolean\": false,
            \"emptyBlob\": \"\",
            \"zeroByte\": 0,
            \"zeroShort\": 0,
            \"zeroInteger\": 0,
            \"zeroLong\": 0,
            \"zeroFloat\": 0.0,
            \"zeroDouble\": 0.0
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Client skips top level default values in input.
 */
it.skip("RpcV2JsonRequestClientSkipsTopLevelDefaultValuesInInput:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new OperationWithDefaultsCommand(
    {
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/OperationWithDefaults");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{}`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Client uses explicitly provided member values over defaults
 */
it.skip("RpcV2JsonRequestClientUsesExplicitlyProvidedMemberValuesOverDefaults:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new OperationWithDefaultsCommand(
    {
      defaults: {
        defaultString: "bye",
        defaultBoolean: true,
        defaultList: [
          "a",
        ],
        defaultTimestamp: new Date(1000),
        defaultBlob: Uint8Array.from("hi", (c) => c.charCodeAt(0)),
        defaultByte: 2,
        defaultShort: 2,
        defaultInteger: 20,
        defaultLong: 200,
        defaultFloat: 2.0,
        defaultDouble: 2.0,
        defaultMap: {
          name: "Jack",
        } as any,
        defaultEnum: "BAR",
        defaultIntEnum: 2,
        emptyString: "foo",
        falseBoolean: true,
        emptyBlob: Uint8Array.from("hi", (c) => c.charCodeAt(0)),
        zeroByte: 1,
        zeroShort: 1,
        zeroInteger: 1,
        zeroLong: 1,
        zeroFloat: 1.0,
        zeroDouble: 1.0,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/OperationWithDefaults");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"defaults\": {
            \"defaultString\": \"bye\",
            \"defaultBoolean\": true,
            \"defaultList\": [\"a\"],
            \"defaultTimestamp\": 1,
            \"defaultBlob\": \"aGk=\",
            \"defaultByte\": 2,
            \"defaultShort\": 2,
            \"defaultInteger\": 20,
            \"defaultLong\": 200,
            \"defaultFloat\": 2.0,
            \"defaultDouble\": 2.0,
            \"defaultMap\": {\"name\": \"Jack\"},
            \"defaultEnum\": \"BAR\",
            \"defaultIntEnum\": 2,
            \"emptyString\": \"foo\",
            \"falseBoolean\": true,
            \"emptyBlob\": \"aGk=\",
            \"zeroByte\": 1,
            \"zeroShort\": 1,
            \"zeroInteger\": 1,
            \"zeroLong\": 1,
            \"zeroFloat\": 1.0,
            \"zeroDouble\": 1.0
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Any time a value is provided for a member in the top level of input, it is used, regardless of if its the default.
 */
it.skip("RpcV2JsonRequestClientUsesExplicitlyProvidedValuesInTopLevel:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new OperationWithDefaultsCommand(
    {
      topLevelDefault: "hi",
      otherTopLevelDefault: 0,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/OperationWithDefaults");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"topLevelDefault\": \"hi\",
        \"otherTopLevelDefault\": 0
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Typically, non top-level members would have defaults filled in, but if they have the clientOptional trait, the defaults should be ignored.
 */
it.skip("RpcV2JsonRequestClientIgnoresNonTopLevelDefaultsOnMembersWithClientOptional:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new OperationWithDefaultsCommand(
    {
      clientOptionalDefaults: {
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/OperationWithDefaults");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"clientOptionalDefaults\": {}
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Client populates default values when missing in response.
 */
it.skip("RpcV2JsonResponseClientPopulatesDefaultsValuesWhenMissingInResponse:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{}`
    ),
  });

  const params: any = {};
  const command = new OperationWithDefaultsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      defaultString: "hi",
      defaultBoolean: true,
      defaultList: [
      ],
      defaultTimestamp: new Date(0 * 1000),
      defaultBlob: Uint8Array.from("abc", (c) => c.charCodeAt(0)),
      defaultByte: 1,
      defaultShort: 1,
      defaultInteger: 10,
      defaultLong: 100,
      defaultFloat: 1.0,
      defaultDouble: 1.0,
      defaultMap: {
      },
      defaultEnum: "FOO",
      defaultIntEnum: 1,
      emptyString: "",
      falseBoolean: false,
      emptyBlob: Uint8Array.from("", (c) => c.charCodeAt(0)),
      zeroByte: 0,
      zeroShort: 0,
      zeroInteger: 0,
      zeroLong: 0,
      zeroFloat: 0.0,
      zeroDouble: 0.0,
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Client ignores default values if member values are present in the response.
 */
it.skip("RpcV2JsonResponseClientIgnoresDefaultValuesIfMemberValuesArePresentInResponse:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "defaultString": "bye",
          "defaultBoolean": false,
          "defaultList": ["a"],
          "defaultTimestamp": 2,
          "defaultBlob": "aGk=",
          "defaultByte": 2,
          "defaultShort": 2,
          "defaultInteger": 20,
          "defaultLong": 200,
          "defaultFloat": 2.0,
          "defaultDouble": 2.0,
          "defaultMap": {"name": "Jack"},
          "defaultEnum": "BAR",
          "defaultIntEnum": 2,
          "emptyString": "foo",
          "falseBoolean": true,
          "emptyBlob": "aGk=",
          "zeroByte": 1,
          "zeroShort": 1,
          "zeroInteger": 1,
          "zeroLong": 1,
          "zeroFloat": 1.0,
          "zeroDouble": 1.0
      }`
    ),
  });

  const params: any = {};
  const command = new OperationWithDefaultsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      defaultString: "bye",
      defaultBoolean: false,
      defaultList: [
        "a",
      ],
      defaultTimestamp: new Date(2 * 1000),
      defaultBlob: Uint8Array.from("hi", (c) => c.charCodeAt(0)),
      defaultByte: 2,
      defaultShort: 2,
      defaultInteger: 20,
      defaultLong: 200,
      defaultFloat: 2.0,
      defaultDouble: 2.0,
      defaultMap: {
        name: "Jack",
      },
      defaultEnum: "BAR",
      defaultIntEnum: 2,
      emptyString: "foo",
      falseBoolean: true,
      emptyBlob: Uint8Array.from("hi", (c) => c.charCodeAt(0)),
      zeroByte: 1,
      zeroShort: 1,
      zeroInteger: 1,
      zeroLong: 1,
      zeroFloat: 1.0,
      zeroDouble: 1.0,
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * When input is empty we write an empty JSON object
 */
it("RpcV2JsonRequestOptionalInput:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new OptionalInputOutputCommand(
    {
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/OptionalInputOutput");

    expect(
      r.headers["x-amz-target"],
      `Header key "x-amz-target" should have been undefined in ${JSON.stringify(r.headers)}`
    ).toBeUndefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{}`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * When output is empty we write an empty JSON object
 */
it("RpcV2JsonResponseOptionalOutput:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{}`
    ),
  });

  const params: any = {};
  const command = new OptionalInputOutputCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
});

/**
 * Serializes recursive structures
 */
it("RpcV2JsonRequestRecursiveShapes:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RecursiveShapesCommand(
    {
      nested: {
        foo: "Foo1",
        nested: {
          bar: "Bar1",
          recursiveMember: {
            foo: "Foo2",
            nested: {
              bar: "Bar2",
            } as any,
          } as any,
        } as any,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RecursiveShapes");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"nested\": {
            \"foo\": \"Foo1\",
            \"nested\": {
                \"bar\": \"Bar1\",
                \"recursiveMember\": {
                    \"foo\": \"Foo2\",
                    \"nested\": {
                        \"bar\": \"Bar2\"
                    }
                }
            }
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes recursive structures
 */
it("RpcV2JsonResponseRecursiveShapes:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "nested": {
              "foo": "Foo1",
              "nested": {
                  "bar": "Bar1",
                  "recursiveMember": {
                      "foo": "Foo2",
                      "nested": {
                          "bar": "Bar2"
                      }
                  }
              }
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RecursiveShapesCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      nested: {
        foo: "Foo1",
        nested: {
          bar: "Bar1",
          recursiveMember: {
            foo: "Foo2",
            nested: {
              bar: "Bar2",
            },
          },
        },
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes maps
 */
it("RpcV2JsonRequestMaps:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonDenseMapsCommand(
    {
      denseStructMap: {
        foo: {
          hi: "there",
        } as any,
        baz: {
          hi: "bye",
        } as any,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonDenseMaps");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"denseStructMap\": {
            \"foo\": {
                \"hi\": \"there\"
            },
            \"baz\": {
                \"hi\": \"bye\"
            }
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Ensure that 0 and false are sent over the wire in all maps and lists
 */
it("RpcV2JsonRequestSerializesZeroValuesInMaps:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonDenseMapsCommand(
    {
      denseNumberMap: {
        x: 0,
      } as any,
      denseBooleanMap: {
        x: false,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonDenseMaps");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"denseNumberMap\": {
            \"x\": 0
        },
        \"denseBooleanMap\": {
            \"x\": false
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * A request that contains a dense map of sets.
 */
it("RpcV2JsonRequestSerializesDenseSetMap:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonDenseMapsCommand(
    {
      denseSetMap: {
        x: [
        ],
        y: [
          "a",
          "b",
        ],
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonDenseMaps");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"denseSetMap\": {
            \"x\": [],
            \"y\": [\"a\", \"b\"]
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Deserializes maps
 */
it("RpcV2JsonResponseMaps:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "denseStructMap": {
              "foo": {
                  "hi": "there"
              },
              "baz": {
                  "hi": "bye"
              }
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonDenseMapsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      denseStructMap: {
        foo: {
          hi: "there",
        },
        baz: {
          hi: "bye",
        },
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Ensure that 0 and false are sent over the wire in all maps and lists
 */
it("RpcV2JsonResponseDeserializesZeroValuesInMaps:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "denseNumberMap": {
              "x": 0
          },
          "denseBooleanMap": {
              "x": false
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonDenseMapsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      denseNumberMap: {
        x: 0,
      },
      denseBooleanMap: {
        x: false,
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * A response that contains a dense map of sets
 */
it("RpcV2JsonResponseDeserializesDenseSetMap:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "denseSetMap": {
              "x": [],
              "y": ["a", "b"]
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonDenseMapsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      denseSetMap: {
        x: [
        ],
        y: [
          "a",
          "b",
        ],
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes RpcV2 JSON lists
 */
it("RpcV2JsonRequestLists:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonListsCommand(
    {
      stringList: [
        "foo",
        "bar",
      ],
      stringSet: [
        "foo",
        "bar",
      ],
      integerList: [
        1,
        2,
      ],
      booleanList: [
        true,
        false,
      ],
      timestampList: [
        new Date(1398796238000),
        new Date(1398796238000),
      ],
      enumList: [
        "Foo",
        "0",
      ],
      intEnumList: [
        1,
        2,
      ],
      nestedStringList: [
        [
          "foo",
          "bar",
        ],
        [
          "baz",
          "qux",
        ],
      ],
      structureList: [
        {
          a: "1",
          b: "2",
        } as any,
        {
          a: "3",
          b: "4",
        } as any,
      ],
      blobList: [
        Uint8Array.from("foo", (c) => c.charCodeAt(0)),
        Uint8Array.from("bar", (c) => c.charCodeAt(0)),
      ],
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonLists");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"stringList\": [
            \"foo\",
            \"bar\"
        ],
        \"stringSet\": [
            \"foo\",
            \"bar\"
        ],
        \"integerList\": [
            1,
            2
        ],
        \"booleanList\": [
            true,
            false
        ],
        \"timestampList\": [
            1398796238,
            1398796238
        ],
        \"enumList\": [
            \"Foo\",
            \"0\"
        ],
        \"intEnumList\": [
            1,
            2
        ],
        \"nestedStringList\": [
            [
                \"foo\",
                \"bar\"
            ],
            [
                \"baz\",
                \"qux\"
            ]
        ],
        \"structureList\": [
            {
                \"a\": \"1\",
                \"b\": \"2\"
            },
            {
                \"a\": \"3\",
                \"b\": \"4\"
            }
        ],
        \"blobList\": [
            \"Zm9v\",
            \"YmFy\"
        ]
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes empty JSON lists
 */
it("RpcV2JsonRequestListsEmpty:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonListsCommand(
    {
      stringList: [
      ],
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonLists");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"stringList\": []
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes RpcV2 JSON lists
 */
it("RpcV2JsonResponseLists:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "stringList": [
              "foo",
              "bar"
          ],
          "stringSet": [
              "foo",
              "bar"
          ],
          "integerList": [
              1,
              2
          ],
          "booleanList": [
              true,
              false
          ],
          "timestampList": [
              1398796238,
              1398796238
          ],
          "enumList": [
              "Foo",
              "0"
          ],
          "intEnumList": [
              1,
              2
          ],
          "nestedStringList": [
              [
                  "foo",
                  "bar"
              ],
              [
                  "baz",
                  "qux"
              ]
          ],
          "structureList": [
              {
                  "a": "1",
                  "b": "2"
              },
              {
                  "a": "3",
                  "b": "4"
              }
          ],
          "blobList": [
              "Zm9v",
              "YmFy"
          ]
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonListsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      stringList: [
        "foo",
        "bar",
      ],
      stringSet: [
        "foo",
        "bar",
      ],
      integerList: [
        1,
        2,
      ],
      booleanList: [
        true,
        false,
      ],
      timestampList: [
        new Date(1398796238 * 1000),
        new Date(1398796238 * 1000),
      ],
      enumList: [
        "Foo",
        "0",
      ],
      intEnumList: [
        1,
        2,
      ],
      nestedStringList: [
        [
          "foo",
          "bar",
        ],
        [
          "baz",
          "qux",
        ],
      ],
      structureList: [
        {
          a: "1",
          b: "2",
        },
        {
          a: "3",
          b: "4",
        },
      ],
      blobList: [
        Uint8Array.from("foo", (c) => c.charCodeAt(0)),
        Uint8Array.from("bar", (c) => c.charCodeAt(0)),
      ],
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes empty RpcV2 JSON lists
 */
it("RpcV2JsonResponseListsEmpty:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "stringList": []
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonListsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      stringList: [
      ],
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes sparse maps
 */
it("RpcV2JsonRequestSparseMaps:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonSparseMapsCommand(
    {
      sparseStructMap: {
        foo: {
          hi: "there",
        } as any,
        baz: {
          hi: "bye",
        } as any,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonSparseMaps");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"sparseStructMap\": {
            \"foo\": {
                \"hi\": \"there\"
            },
            \"baz\": {
                \"hi\": \"bye\"
            }
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes null map values in sparse maps
 */
it("RpcV2JsonRequestSerializesNullMapValues:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonSparseMapsCommand(
    {
      sparseBooleanMap: {
        x: null,
      } as any,
      sparseNumberMap: {
        x: null,
      } as any,
      sparseStringMap: {
        x: null,
      } as any,
      sparseStructMap: {
        x: null,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonSparseMaps");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"sparseBooleanMap\": {
            \"x\": null
        },
        \"sparseNumberMap\": {
            \"x\": null
        },
        \"sparseStringMap\": {
            \"x\": null
        },
        \"sparseStructMap\": {
            \"x\": null
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * A request that contains a sparse map of sets
 */
it("RpcV2JsonRequestSerializesSparseSetMap:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonSparseMapsCommand(
    {
      sparseSetMap: {
        x: [
        ],
        y: [
          "a",
          "b",
        ],
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonSparseMaps");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"sparseSetMap\": {
            \"x\": [],
            \"y\": [\"a\", \"b\"]
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * A request that contains a sparse map of sets.
 */
it("RpcV2JsonRequestSerializesSparseSetMapAndRetainsNull:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonSparseMapsCommand(
    {
      sparseSetMap: {
        x: [
        ],
        y: [
          "a",
          "b",
        ],
        z: null,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonSparseMaps");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"sparseSetMap\": {
            \"x\": [],
            \"y\": [\"a\", \"b\"],
            \"z\": null
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Ensure that 0 and false are sent over the wire in all maps and lists
 */
it("RpcV2JsonRequestSerializesZeroValuesInSparseMaps:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new RpcV2JsonSparseMapsCommand(
    {
      sparseNumberMap: {
        x: 0,
      } as any,
      sparseBooleanMap: {
        x: false,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/RpcV2JsonSparseMaps");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"sparseNumberMap\": {
            \"x\": 0
        },
        \"sparseBooleanMap\": {
            \"x\": false
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Deserializes sparse maps
 */
it("RpcV2JsonResponseSparseJsonMaps:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "sparseStructMap": {
              "foo": {
                  "hi": "there"
              },
              "baz": {
                  "hi": "bye"
              }
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonSparseMapsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      sparseStructMap: {
        foo: {
          hi: "there",
        },
        baz: {
          hi: "bye",
        },
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Deserializes null map values
 */
it("RpcV2JsonResponseDeserializesNullMapValues:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "sparseBooleanMap": {
              "x": null
          },
          "sparseNumberMap": {
              "x": null
          },
          "sparseStringMap": {
              "x": null
          },
          "sparseStructMap": {
              "x": null
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonSparseMapsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      sparseBooleanMap: {
        x: null,
      },
      sparseNumberMap: {
        x: null,
      },
      sparseStringMap: {
        x: null,
      },
      sparseStructMap: {
        x: null,
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * A response that contains a sparse map of sets
 */
it("RpcV2JsonResponseDeserializesSparseSetMap:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "sparseSetMap": {
              "x": [],
              "y": ["a", "b"]
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonSparseMapsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      sparseSetMap: {
        x: [
        ],
        y: [
          "a",
          "b",
        ],
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * A response that contains a sparse map of sets with a null
 */
it("RpcV2JsonResponseDeserializesSparseSetMapAndRetainsNull:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "sparseSetMap": {
              "x": [],
              "y": ["a", "b"],
              "z": null
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonSparseMapsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      sparseSetMap: {
        x: [
        ],
        y: [
          "a",
          "b",
        ],
        z: null,
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Ensure that 0 and false are sent over the wire in all maps and lists
 */
it("RpcV2JsonResponseDeserializesZeroValuesInSparseMaps:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "sparseNumberMap": {
              "x": 0
          },
          "sparseBooleanMap": {
              "x": false
          }
      }`
    ),
  });

  const params: any = {};
  const command = new RpcV2JsonSparseMapsCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      sparseNumberMap: {
        x: 0,
      },
      sparseBooleanMap: {
        x: false,
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes simple scalar properties
 */
it("RpcV2JsonRequestSimpleScalarProperties:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new SimpleScalarPropertiesCommand(
    {
      byteValue: 5,
      doubleValue: 1.889,
      falseBooleanValue: false,
      floatValue: 7.625,
      integerValue: 256,
      longValue: 9873,
      shortValue: 9898,
      stringValue: "simple",
      trueBooleanValue: true,
      blobValue: Uint8Array.from("foo", (c) => c.charCodeAt(0)),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/SimpleScalarProperties");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"byteValue\": 5,
        \"doubleValue\": 1.889,
        \"falseBooleanValue\": false,
        \"floatValue\": 7.625,
        \"integerValue\": 256,
        \"longValue\": 9873,
        \"shortValue\": 9898,
        \"stringValue\": \"simple\",
        \"trueBooleanValue\": true,
        \"blobValue\": \"Zm9v\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * RpcV2 JSON should not serialize null structure values
 */
it("RpcV2JsonRequestClientDoesntSerializeNullStructureValues:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new SimpleScalarPropertiesCommand(
    {
      stringValue: null,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/SimpleScalarProperties");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{}`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Supports handling NaN float values.
 */
it("RpcV2JsonRequestSupportsNaNFloatInputs:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new SimpleScalarPropertiesCommand(
    {
      doubleValue: NaN,
      floatValue: NaN,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/SimpleScalarProperties");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"doubleValue\": \"NaN\",
        \"floatValue\": \"NaN\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Supports handling Infinity float values.
 */
it("RpcV2JsonRequestSupportsInfinityFloatInputs:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new SimpleScalarPropertiesCommand(
    {
      doubleValue: Infinity,
      floatValue: Infinity,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/SimpleScalarProperties");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"doubleValue\": \"Infinity\",
        \"floatValue\": \"Infinity\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Supports handling -Infinity float values.
 */
it("RpcV2JsonRequestSupportsNegativeInfinityFloatInputs:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new SimpleScalarPropertiesCommand(
    {
      doubleValue: -Infinity,
      floatValue: -Infinity,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/SimpleScalarProperties");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"doubleValue\": \"-Infinity\",
        \"floatValue\": \"-Infinity\"
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes simple scalar properties
 */
it("RpcV2JsonResponseSimpleScalarProperties:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "trueBooleanValue": true,
          "falseBooleanValue": false,
          "byteValue": 5,
          "doubleValue": 1.889,
          "floatValue": 7.625,
          "integerValue": 256,
          "shortValue": 9898,
          "stringValue": "simple",
          "blobValue": "Zm9v"
      }`
    ),
  });

  const params: any = {};
  const command = new SimpleScalarPropertiesCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      trueBooleanValue: true,
      falseBooleanValue: false,
      byteValue: 5,
      doubleValue: 1.889,
      floatValue: 7.625,
      integerValue: 256,
      shortValue: 9898,
      stringValue: "simple",
      blobValue: Uint8Array.from("foo", (c) => c.charCodeAt(0)),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * RpcV2 JSON should not deserialize null structure values
 */
it("RpcV2JsonResponseClientDoesntDeserializeNullStructureValues:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "stringValue": null
      }`
    ),
  });

  const params: any = {};
  const command = new SimpleScalarPropertiesCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
});

/**
 * Supports handling NaN float values.
 */
it("RpcV2JsonResponseSupportsNaNFloatOutputs:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "doubleValue": "NaN",
          "floatValue": "NaN"
      }`
    ),
  });

  const params: any = {};
  const command = new SimpleScalarPropertiesCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      doubleValue: NaN,
      floatValue: NaN,
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Supports handling Infinity float values.
 */
it("RpcV2JsonResponseSupportsInfinityFloatOutputs:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "doubleValue": "Infinity",
          "floatValue": "Infinity"
      }`
    ),
  });

  const params: any = {};
  const command = new SimpleScalarPropertiesCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      doubleValue: Infinity,
      floatValue: Infinity,
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Supports handling Negative Infinity float values.
 */
it("RpcV2JsonResponseSupportsNegativeInfinityFloatOutputs:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "doubleValue": "-Infinity",
          "floatValue": "-Infinity"
      }`
    ),
  });

  const params: any = {};
  const command = new SimpleScalarPropertiesCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      doubleValue: -Infinity,
      floatValue: -Infinity,
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * The client should skip over additional fields that are not part of the structure. This allows a
 * client generated against an older Smithy model to be able to communicate with a server that is
 * generated against a newer Smithy model.
 */
it("RpcV2JsonResponseExtraFieldsInTheBodyShouldBeSkippedByClients:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "byteValue": 5,
          "doubleValue": 1.889,
          "falseBooleanValue": false,
          "floatValue": 7.625,
          "extraObject": {
              "normalString": "foo",
              "withAnArray": [1, 2, 3]
          },
          "integerValue": 256,
          "longValue": 9873,
          "shortValue": 9898,
          "stringValue": "simple",
          "someOtherField": "this should be skipped",
          "trueBooleanValue": true,
          "blobValue": "Zm9v"
      }`
    ),
  });

  const params: any = {};
  const command = new SimpleScalarPropertiesCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      byteValue: 5,
      doubleValue: 1.889,
      falseBooleanValue: false,
      floatValue: 7.625,
      integerValue: 256,
      longValue: 9873,
      shortValue: 9898,
      stringValue: "simple",
      trueBooleanValue: true,
      blobValue: Uint8Array.from("foo", (c) => c.charCodeAt(0)),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Serializes null values in maps
 */
it("RpcV2JsonRequestSparseMapsSerializeNullValues:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new SparseNullsOperationCommand(
    {
      sparseStringMap: {
        foo: null,
      } as any,
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/SparseNullsOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"sparseStringMap\": {
            \"foo\": null
        }
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Serializes null values in lists
 */
it("RpcV2JsonRequestSparseListsSerializeNull:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new SparseNullsOperationCommand(
    {
      sparseStringList: [
        null,
      ],
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/SparseNullsOperation");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"sparseStringList\": [
            null
        ]
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * Deserializes null values in maps
 */
it("RpcV2JsonResponseSparseMapsDeserializeNullValues:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "sparseStringMap": {
              "foo": null
          }
      }`
    ),
  });

  const params: any = {};
  const command = new SparseNullsOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      sparseStringMap: {
        foo: null,
      },
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Deserializes null values in lists
 */
it("RpcV2JsonResponseSparseListsDeserializeNull:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "sparseStringList": [
              null
          ]
      }`
    ),
  });

  const params: any = {};
  const command = new SparseNullsOperationCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      sparseStringList: [
        null,
      ],
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * The rpcv2Json protocol always serializes timestamps as epoch-seconds JSON numbers.
 * The timestampFormat trait MUST NOT be respected.
 */
it("RpcV2JsonRequestTimestampFormatIgnored:Request", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new TimestampFormatIgnoredCommand(
    {
      dateTime: new Date(946845296000),
      httpDate: new Date(946845296000),
      epochSeconds: new Date(946845296000),
      normal: new Date(946845296000),
    } as any,
  );
  try {
    await client.send(command);
    fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
    return;
  } catch (err) {
    if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
      fail(err);
      return;
    }
    const r = err.request;
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/service/RpcV2JsonProtocol/operation/TimestampFormatIgnored");
    expect(
      r.headers["content-length"],
      `Header key "content-length" should have been defined in ${JSON.stringify(r.headers)}`
    ).toBeDefined();

    expect(r.headers["accept"]).toBe("application/json");
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.headers["smithy-protocol"]).toBe("rpc-v2-json");

    expect(r.body, `Body was undefined.`).toBeDefined();
    const utf8Encoder = client.config.utf8Encoder;
    const bodyString = `{
        \"dateTime\": 946845296,
        \"httpDate\": 946845296,
        \"epochSeconds\": 946845296,
        \"normal\": 946845296
    }`;
    const unequalParts: any = compareEquivalentJsonBodies(bodyString, r.body.toString());
    expect(unequalParts).toBeUndefined();
  }
});

/**
 * The rpcv2Json protocol always serializes timestamps as epoch-seconds JSON numbers.
 * The timestampFormat trait MUST NOT be respected.
 */
it("RpcV2JsonResponseTimestampFormatIgnored:Response", async () => {
  const client = new RpcV2JsonProtocolClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      },
      `{
          "dateTime": 946845296,
          "httpDate": 946845296,
          "epochSeconds": 946845296,
          "normal": 946845296
      }`
    ),
  });

  const params: any = {};
  const command = new TimestampFormatIgnoredCommand(params);

  let r: any;
  try {
    r = await client.send(command);
  } catch (err) {
    fail("Expected a valid response to be returned, got " + err);
    return;
  }
  expect(r.$metadata.httpStatusCode).toBe(200);
  const paramsToValidate: any = [
    {
      dateTime: new Date(946845296 * 1000),
      httpDate: new Date(946845296 * 1000),
      epochSeconds: new Date(946845296 * 1000),
      normal: new Date(946845296 * 1000),
    },
  ][0];
  Object.keys(paramsToValidate).forEach((param) => {
    expect(
      r[param],
      `The output field ${param} should have been defined in ${JSON.stringify(
        r,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )}`
    ).toBeDefined();
    expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);
  });
});

/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentJsonBodies = (expectedBody: string, generatedBody: string): Object => {
  const expectedParts = JSON.parse(expectedBody);
  const generatedParts = JSON.parse(generatedBody);

  return compareParts(expectedParts, generatedParts);
};
