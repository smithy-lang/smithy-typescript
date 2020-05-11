import { HttpHandlerOptions, HeaderBag } from "@aws-sdk/types";
import { HttpHandler, HttpRequest, HttpResponse } from "@aws-sdk/protocol-http";
import { Readable } from 'stream';

/**
 * Throws an expected exception that contains the serialized request.
 */
class EXPECTED_REQUEST_SERIALIZATION_ERROR {
    constructor(readonly request: HttpRequest) {}
}

/**
 * Throws an EXPECTED_REQUEST_SERIALIZATION_ERROR error before sending a
 * request. The thrown exception contains the serialized request.
 */
class RequestSerializationTestHandler implements HttpHandler {
    handle(
        request: HttpRequest,
        options: HttpHandlerOptions
    ): Promise<{ response: HttpResponse }> {
        return Promise.reject(new EXPECTED_REQUEST_SERIALIZATION_ERROR(request));
    }
}

/**
 * Returns a resolved Promise of the specified response contents.
 */
class ResponseDeserializationTestHandler implements HttpHandler {
    isSuccess: boolean;
    code: number;
    headers: HeaderBag;
    body: String;

    constructor(
        isSuccess: boolean,
        code: number,
        headers?: HeaderBag,
        body?: String
    ) {
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
    }

    handle(
        request: HttpRequest,
        options: HttpHandlerOptions
    ): Promise<{ response: HttpResponse }> {
        return Promise.resolve({
            response: {
                statusCode: this.code,
                headers: this.headers,
                body: Readable.from([this.body])
            }
        });
    }
}

interface comparableParts {
  [ key: string ]: string
}

/**
 * Generates a standard map of un-equal values given input parts.
 */
const compareParts = (expectedParts: comparableParts, generatedParts: comparableParts) => {
  const unequalParts: any = {};
  Object.keys(expectedParts).forEach(key => {
    if (generatedParts[key] === undefined) {
      unequalParts[key] = { exp: expectedParts[key], gen: undefined };
    } else if (!equivalentContents(expectedParts[key], generatedParts[key])) {
      unequalParts[key] = { exp: expectedParts[key], gen: generatedParts[key] };
    }
  });

  Object.keys(generatedParts).forEach(key => {
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
 * equality checks based on non-'__type', non-`$$metadata`
 * properties that have defined values.
 */
const equivalentContents = (expected: any, generated: any): boolean => {
  let localExpected = expected;

  // Short circuit on equality.
  if (localExpected == generated) {
    return true;
  }

  // If a test fails with an issue in the below 6 lines, it's likely
  // due to an issue in the nestedness or existence of the property
  // being compared.
  delete localExpected['__type'];
  delete generated['__type'];
  delete localExpected['$$metadata'];
  delete generated['$$metadata'];
  Object.keys(localExpected).forEach(key => localExpected[key] === undefined && delete localExpected[key])
  Object.keys(generated).forEach(key => generated[key] === undefined && delete generated[key])

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
}
