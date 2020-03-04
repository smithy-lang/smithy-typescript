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
    body: Readable;

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
        this.body = Readable.from([body]);
    }

    handle(
        request: HttpRequest,
        options: HttpHandlerOptions
    ): Promise<{ response: HttpResponse }> {
        return Promise.resolve({
            response: {
                statusCode: this.code,
                headers: this.headers,
                body: this.body
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
    } else if (generatedParts[key] !== expectedParts[key]) {
      unequalParts[key] = { exp: expectedParts[key], gen: generatedParts[key] };
    }
  });

  Object.keys(generatedParts).forEach(key => {
    if (expectedParts[key] === undefined) {
      unequalParts[key] = { exp: undefined, gen: generatedParts[key] };
    } else if (expectedParts[key] !== generatedParts[key]) {
      unequalParts[key] = { exp: expectedParts[key], gen: generatedParts[key] };
    }
  });

  if (Object.keys(unequalParts).length !== 0) {
    return unequalParts;
  }
  return undefined;
};
