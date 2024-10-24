import { EndpointBearer, SerdeFunctions } from "@smithy/types";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { deserializerMiddleware } from "./deserializerMiddleware";

describe("deserializerMiddleware", () => {
  const mockNext = vi.fn();
  const mockDeserializer = vi.fn();

  const mockOptions = {
    endpoint: () =>
      Promise.resolve({
        protocol: "protocol",
        hostname: "hostname",
        path: "path",
      }),
  } as EndpointBearer & SerdeFunctions;

  const mockArgs = {
    input: {
      inputKey: "inputValue",
    },
    request: {
      method: "GET",
      headers: {},
    },
  };

  const mockOutput = {
    $metadata: {
      statusCode: 200,
      requestId: "requestId",
    },
    outputKey: "outputValue",
  };

  const mockNextResponse = {
    response: {
      statusCode: 200,
      headers: {},
    },
  };

  const mockResponse = {
    response: mockNextResponse.response,
    output: mockOutput,
  };

  beforeEach(() => {
    mockNext.mockResolvedValueOnce(mockNextResponse);
    mockDeserializer.mockResolvedValueOnce(mockOutput);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls deserializer and populates response object", async () => {
    await expect(deserializerMiddleware(mockOptions, mockDeserializer)(mockNext, {})(mockArgs)).resolves.toStrictEqual(
      mockResponse
    );

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith(mockArgs);
    expect(mockDeserializer).toHaveBeenCalledTimes(1);
    expect(mockDeserializer).toHaveBeenCalledWith(mockNextResponse.response, mockOptions);
  });

  it("injects non-enumerable $response reference to deserializing exceptions", async () => {
    const exception = Object.assign(new Error("MockException"), mockNextResponse.response);
    mockDeserializer.mockReset();
    mockDeserializer.mockRejectedValueOnce(exception);
    try {
      await deserializerMiddleware(mockOptions, mockDeserializer)(mockNext, {})(mockArgs);
      fail("DeserializerMiddleware should throw");
    } catch (e) {
      expect(e).toMatchObject(exception);
      expect(e.$response).toEqual(mockNextResponse.response);
      expect(Object.keys(e)).not.toContain("$response");
    }
  });

  it("adds a hint about $response to the message of the thrown error", async () => {
    const exception = Object.assign(new Error("MockException"), mockNextResponse.response, {
      $response: {
        body: "",
      },
      $responseBodyText: "oh no",
    });
    mockDeserializer.mockReset();
    mockDeserializer.mockRejectedValueOnce(exception);
    try {
      await deserializerMiddleware(mockOptions, mockDeserializer)(mockNext, {})(mockArgs);
      fail("DeserializerMiddleware should throw");
    } catch (e) {
      expect(e.message).toContain(
        "to see the raw response, inspect the hidden field {error}.$response on this object."
      );
      expect(e.$response.body).toEqual("oh no");
    }
  });
});
