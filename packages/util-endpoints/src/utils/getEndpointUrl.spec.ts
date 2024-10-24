import { describe, expect, test as it, vi } from "vitest";

import { EndpointError } from "../types";
import { evaluateExpression } from "./evaluateExpression";
import { getEndpointUrl } from "./getEndpointUrl";

vi.mock("./evaluateExpression");

describe(getEndpointUrl.name, () => {
  const mockEndpointUrlInput = "http://input.example.com";
  const mockEndpointUrlOutput = "http://output.example.com";
  const mockOptions = {
    endpointParams: {},
    referenceRecord: {},
  };

  it("returns URL is expression evaluates to string", () => {
    vi.mocked(evaluateExpression).mockReturnValue(mockEndpointUrlOutput);
    const result = getEndpointUrl(mockEndpointUrlInput, mockOptions);
    expect(result).toEqual(new URL(mockEndpointUrlOutput));
    expect(evaluateExpression).toHaveBeenCalledWith(mockEndpointUrlInput, "Endpoint URL", mockOptions);
  });

  it("throws error if expression evaluates to non-string", () => {
    const mockNotStringOutput = 42;
    vi.mocked(evaluateExpression).mockReturnValue(mockNotStringOutput);
    expect(() => getEndpointUrl(mockEndpointUrlInput, mockOptions)).toThrowError(
      new EndpointError(`Endpoint URL must be a string, got ${typeof mockNotStringOutput}`)
    );
    expect(evaluateExpression).toHaveBeenCalledWith(mockEndpointUrlInput, "Endpoint URL", mockOptions);
  });
});
