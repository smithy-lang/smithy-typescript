/**
 * Resource files copied from the Java codegen, embedded so the package needs no asset loading.
 */
export const PROTOCOL_TEST_STUBS: Readonly<Record<string, string>> = {
  "protocol-test-stub.ts": `import { Readable } from "node:stream";
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
 * equality checks based on non-\`$$metadata\`
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
  delete localExpected["$$metadata"];
  delete generated["$$metadata"];
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
 * A wrapper function that shadows \`fail\` from jest-jasmine2
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
`,
  "protocol-test-cbor-stub.ts": `const compareEquivalentCborBodies = (expectedBody: string, generatedBody: string | Uint8Array): undefined => {
  expect(
    normalizeByteArrayType(cbor.deserialize(typeof generatedBody === "string" ? toBytes(generatedBody) : generatedBody))
  ).toEqual(normalizeByteArrayType(cbor.deserialize(toBytes(expectedBody))));
  return undefined;
};
`,
  "protocol-test-form-urlencoded-stub.ts": `/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentFormUrlencodedBodies = (expectedBody: string, generatedBody: string): Object => {
  const fromEntries = (components: string[][]): Record<string, string> => {
    const parts: Record<string, string> = {};

    components.forEach((component) => {
      parts[component[0]] = component[1];
    });

    return parts;
  };

  // Generate to k:v maps from query components
  const expectedParts = fromEntries(expectedBody.split("&").map((part) => part.trim().split("=")));
  const generatedParts = fromEntries(generatedBody.split("&").map((part) => part.trim().split("=")));

  return compareParts(expectedParts, generatedParts);
};
`,
  "protocol-test-json-stub.ts": `/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentJsonBodies = (expectedBody: string, generatedBody: string): Object => {
  const expectedParts = JSON.parse(expectedBody);
  const generatedParts = JSON.parse(generatedBody);

  return compareParts(expectedParts, generatedParts);
};
`,
  "protocol-test-octet-stream-stub.ts": `/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentOctetStreamBodies = (
  utf8Encoder: __Encoder,
  expectedBody: string,
  generatedBody: Uint8Array
): Object => {
  const expectedParts = { Value: expectedBody };
  const generatedParts = { Value: utf8Encoder(generatedBody) };

  return compareParts(expectedParts, generatedParts);
};
`,
  "protocol-test-text-stub.ts": `/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentTextBodies = (expectedBody: string, generatedBody: string): Object => {
  const expectedParts = { Value: expectedBody };
  const generatedParts = { Value: generatedBody };

  return compareParts(expectedParts, generatedParts);
};
`,
  "protocol-test-unknown-type-stub.ts": `/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentUnknownTypeBodies = (
  utf8Encoder: __Encoder,
  expectedBody: string,
  generatedBody: string | Uint8Array
): Object => {
  const expectedParts = { Value: expectedBody };
  const generatedParts = {
    Value: generatedBody instanceof Uint8Array ? utf8Encoder(generatedBody) : generatedBody,
  };

  return compareParts(expectedParts, generatedParts);
};
`,
  "protocol-test-xml-stub.ts": `/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentXmlBodies = (expectedBody: string, generatedBody: string): Object => {
  const parseConfig = {
    attributeNamePrefix: "",
    processEntities: {
      enabled: true,
      maxTotalExpansions: Infinity,
    },
    htmlEntities: true,
    ignoreAttributes: false,
    ignoreDeclaration: true,
    parseTagValue: false,
    trimValues: false,
    tagValueProcessor: (_: any, val: any) => (val.trim() === "" && val.includes("\\n") ? "" : undefined),
    maxNestedTags: Infinity,
  };

  const parseXmlBody = (body: string) => {
    const parser = new XMLParser(parseConfig);
    const parsedObj = parser.parse(body);
    const textNodeName = "#text";
    const key = Object.keys(parsedObj)[0];
    const parsedObjToReturn = parsedObj[key];
    if (parsedObjToReturn[textNodeName]) {
      parsedObjToReturn[key] = parsedObjToReturn[textNodeName];
      delete parsedObjToReturn[textNodeName];
    }
    return parsedObj;
  };

  const expectedParts = parseXmlBody(expectedBody);
  const generatedParts = parseXmlBody(generatedBody);

  return compareParts(expectedParts, generatedParts);
};
`,
  "malformed-request-test-regex-json-stub.ts": `/**
 * Returns 'true' if the 'message' field in the serialized JSON document matches the given regex.
 */
const matchMessageInJsonBody = (body: string, messageRegex: string): Object => {
  const parsedBody = JSON.parse(body);
  if (!parsedBody.hasOwnProperty("message")) {
    return false;
  }
  return new RegExp(messageRegex).test(parsedBody["message"]);
};
`,
};
