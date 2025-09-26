import type { SchemaRef } from "@smithy/types";
import { beforeEach, describe, expect, test as it, vi } from "vitest";

import { schemaSerializationMiddleware } from "./schemaSerializationMiddleware";

describe(schemaSerializationMiddleware.name, () => {
  const mockNext = vi.fn();
  const mockSerializer = vi.fn();

  const mockProtocol = {
    serializeRequest: mockSerializer,
  };

  const mockOptions = {
    endpoint: () =>
      Promise.resolve({
        protocol: "protocol",
        hostname: "hostname",
        path: "path",
      }),
    protocol: mockProtocol,
  } as any;

  const mockRequest = {
    method: "GET",
    headers: {},
  };

  const mockResponse = {
    statusCode: 200,
    headers: {},
  };

  const mockOutput = {
    $metadata: {
      statusCode: 200,
      requestId: "requestId",
    },
    outputKey: "outputValue",
  };

  const mockReturn = {
    response: mockResponse,
    output: mockOutput,
  };

  const mockArgs = {
    input: {
      inputKey: "inputValue",
    },
  };

  beforeEach(() => {
    mockNext.mockResolvedValueOnce(mockReturn);
    mockSerializer.mockResolvedValueOnce(mockRequest);
  });

  it("calls serializer and populates request object", async () => {
    await expect(schemaSerializationMiddleware(mockOptions)(mockNext, {})(mockArgs)).resolves.toStrictEqual(mockReturn);

    expect(mockSerializer).toHaveBeenCalledTimes(1);
    expect(mockSerializer).toHaveBeenCalledWith(undefined as unknown as SchemaRef, mockArgs.input, {
      ...mockOptions,
      __smithy_context: {},
    });
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith({ ...mockArgs, request: mockRequest });
  });
});
