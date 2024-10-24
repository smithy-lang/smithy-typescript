import { afterEach, describe, expect, test as it, vi } from "vitest";

import { getEndpointProperties } from "./getEndpointProperties";
import { getEndpointProperty } from "./getEndpointProperty";

vi.mock("./getEndpointProperty");

describe(getEndpointProperties.name, () => {
  const mockOptions = {
    endpointParams: {},
    referenceRecord: {},
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return an empty object if empty properties are provided", () => {
    expect(getEndpointProperties({}, mockOptions)).toEqual({});
  });

  it("return processed endpoint properties", () => {
    const inputPropertyValue = "inputPropertyValue";
    const outputPropertyValue = "outputPropertyValue";
    const mockProperties = { key: inputPropertyValue };

    vi.mocked(getEndpointProperty).mockReturnValue(outputPropertyValue);
    expect(getEndpointProperties(mockProperties, mockOptions)).toEqual({ key: outputPropertyValue });
    expect(getEndpointProperty).toHaveBeenCalledWith(inputPropertyValue, mockOptions);
  });
});
