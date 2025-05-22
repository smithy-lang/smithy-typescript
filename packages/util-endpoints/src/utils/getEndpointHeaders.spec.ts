import { afterEach, describe, expect, test as it, vi } from "vitest";

import { evaluateExpression } from "./evaluateExpression";
import { getEndpointHeaders } from "./getEndpointHeaders";

vi.mock("./evaluateExpression");

describe(getEndpointHeaders.name, () => {
  const mockOptions = {
    endpointParams: {},
    referenceRecord: {},
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return an empty object if empty headers are provided", () => {
    expect(getEndpointHeaders({}, mockOptions)).toEqual({});
    expect(evaluateExpression).not.toHaveBeenCalled();
  });

  it("should return processed header", () => {
    const inputHeaderValue = "inputHeaderValue";
    const outputHeaderValue = "outputHeaderValue";
    const mockHeaders = { key: [inputHeaderValue] };

    vi.mocked(evaluateExpression).mockReturnValue(outputHeaderValue);
    expect(getEndpointHeaders(mockHeaders, mockOptions)).toEqual({ key: [outputHeaderValue] });
    expect(evaluateExpression).toHaveBeenCalledWith("inputHeaderValue", "Header value entry", mockOptions);
  });

  it.each([null, undefined, true, 1])(
    "should throw error if evaluated expression is not string: %s",
    (notStringValue: any) => {
      const inputHeaderKey = "inputHeaderKey";
      const inputHeaderValue = "inputHeaderValue";
      const mockHeaders = { [inputHeaderKey]: [inputHeaderValue] };

      vi.mocked(evaluateExpression).mockReturnValue(notStringValue);
      expect(() => getEndpointHeaders(mockHeaders, mockOptions)).toThrowError(
        `Header '${inputHeaderKey}' value '${notStringValue}' is not a string`
      );
      expect(evaluateExpression).toHaveBeenCalledWith("inputHeaderValue", "Header value entry", mockOptions);
    }
  );
});
