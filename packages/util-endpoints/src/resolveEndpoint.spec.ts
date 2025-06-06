import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars */
import { resolveEndpoint } from "./resolveEndpoint";
import { EndpointError, EndpointParams, ParameterObject, RuleSetObject } from "./types";
import { evaluateRules } from "./utils";

vi.mock("./utils");

describe(resolveEndpoint.name, () => {
  const boolParamKey = "boolParamKey";
  const stringParamKey = "stringParamKey";
  const requiredParamKey = "requiredParamKey";
  const paramWithDefaultKey = "paramWithDefaultKey";

  const mockEndpointParams: EndpointParams = {
    [boolParamKey]: true,
    [stringParamKey]: "stringParamValue",
    [requiredParamKey]: "requiredParamValue",
    [paramWithDefaultKey]: "defaultParamValue",
  };

  const mockRules: any[] = [];
  const mockRuleSetParameters: Record<string, ParameterObject> = {
    [boolParamKey]: {
      type: "Boolean",
    },
    [stringParamKey]: {
      type: "String",
    },
    [requiredParamKey]: {
      type: "String",
      required: true,
    },
    [paramWithDefaultKey]: {
      type: "String",
      default: "paramWithDefaultValue",
    },
  };

  const mockRuleSetObject: RuleSetObject = {
    version: "1.0",
    serviceId: "serviceId",
    parameters: mockRuleSetParameters,
    rules: mockRules,
  };

  const mockResolvedEndpoint = { url: new URL("http://example.com") };

  beforeEach(() => {
    vi.mocked(evaluateRules).mockReturnValue(mockResolvedEndpoint);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should use the default value if a parameter is not set", () => {
    const { paramWithDefaultKey: ignored, ...endpointParamsWithoutDefault } = mockEndpointParams;

    const resolvedEndpoint = resolveEndpoint(mockRuleSetObject, { endpointParams: endpointParamsWithoutDefault });
    expect(resolvedEndpoint).toEqual(mockResolvedEndpoint);

    expect(evaluateRules).toHaveBeenCalledWith(mockRules, {
      endpointParams: {
        ...mockEndpointParams,
        [paramWithDefaultKey]: mockRuleSetParameters[paramWithDefaultKey].default,
      },
      referenceRecord: {},
    });
  });

  it("should throw an error if a required parameter is missing", () => {
    const { requiredParamKey: ignored, ...endpointParamsWithoutRequired } = mockEndpointParams;
    expect(() => resolveEndpoint(mockRuleSetObject, { endpointParams: endpointParamsWithoutRequired })).toThrow(
      new EndpointError(`Missing required parameter: '${requiredParamKey}'`)
    );
    expect(evaluateRules).not.toHaveBeenCalled();
  });

  it("should not throw an error if a default value is available for required parameter", () => {
    const { requiredParamKey: ignored, ...endpointParamsWithoutRequired } = mockEndpointParams;
    const requiredParamDefaultValue = "requiredParamDefaultValue";

    const resolvedEndpoint = resolveEndpoint(
      {
        ...mockRuleSetObject,
        parameters: {
          ...mockRuleSetParameters,
          [requiredParamKey]: {
            ...mockRuleSetParameters[requiredParamKey],
            default: requiredParamDefaultValue,
          },
        },
      },
      { endpointParams: endpointParamsWithoutRequired }
    );
    expect(resolvedEndpoint).toEqual(mockResolvedEndpoint);

    expect(evaluateRules).toHaveBeenCalledWith(mockRules, {
      endpointParams: {
        ...mockEndpointParams,
        [requiredParamKey]: requiredParamDefaultValue,
      },
      referenceRecord: {},
    });
  });

  it("should call evaluateRules", () => {
    const resolvedEndpoint = resolveEndpoint(mockRuleSetObject, { endpointParams: mockEndpointParams });
    expect(resolvedEndpoint).toEqual(mockResolvedEndpoint);
    expect(evaluateRules).toHaveBeenCalledWith(mockRules, {
      endpointParams: mockEndpointParams,
      referenceRecord: {},
    });
  });

  it("should debug proper infos", () => {
    const { paramWithDefaultKey: ignored, ...endpointParamsWithoutDefault } = mockEndpointParams;
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const resolvedEndpoint = resolveEndpoint(mockRuleSetObject, {
      endpointParams: endpointParamsWithoutDefault,
      logger: mockLogger,
    });
    expect(resolvedEndpoint).toEqual(mockResolvedEndpoint);

    expect(evaluateRules).toHaveBeenCalledWith(mockRules, {
      endpointParams: {
        ...mockEndpointParams,
        [paramWithDefaultKey]: mockRuleSetParameters[paramWithDefaultKey].default,
      },
      logger: mockLogger,
      referenceRecord: {},
    });

    expect(mockLogger.debug).nthCalledWith(
      1,
      "endpoints " +
        "Initial EndpointParams: " +
        "{\n" +
        '  "boolParamKey": true,\n' +
        '  "stringParamKey": "stringParamValue",\n' +
        '  "requiredParamKey": "requiredParamValue"\n' +
        "}"
    );
    expect(mockLogger.debug).nthCalledWith(2, `endpoints Resolved endpoint: {\n  "url": "http://example.com/"\n}`);
  });
});
