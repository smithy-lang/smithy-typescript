import { EvaluateOptions } from "@smithy/types";
import { afterEach, beforeEach, describe, expect,test as it, vi } from "vitest";

import { debugId, toDebugString } from "../debug";
import { ConditionObject, EndpointRuleObject } from "../types";
import { evaluateConditions } from "./evaluateConditions";
import { evaluateEndpointRule } from "./evaluateEndpointRule";
import { getEndpointHeaders } from "./getEndpointHeaders";
import { getEndpointProperties } from "./getEndpointProperties";
import { getEndpointUrl } from "./getEndpointUrl";

vi.mock("./evaluateConditions");
vi.mock("./getEndpointUrl");
vi.mock("./getEndpointHeaders");
vi.mock("./getEndpointProperties");

describe(evaluateEndpointRule.name, () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const mockOptions: EvaluateOptions = {
    endpointParams: {},
    referenceRecord: {},
    logger: mockLogger,
  };
  const mockConditions: ConditionObject[] = [
    { fn: "fn1", argv: ["arg1"] },
    { fn: "fn2", argv: ["arg2"] },
  ];
  const mockEndpoint = { url: "http://example.com" };
  const mockEndpointRule: EndpointRuleObject = {
    type: "endpoint",
    conditions: mockConditions,
    endpoint: mockEndpoint,
  };

  it("returns undefined if conditions are false", () => {
    vi.mocked(evaluateConditions).mockReturnValue({ result: false });
    const result = evaluateEndpointRule(mockEndpointRule, mockOptions);
    expect(result).toBeUndefined();
    expect(evaluateConditions).toHaveBeenCalledWith(mockConditions, mockOptions);
    expect(getEndpointUrl).not.toHaveBeenCalled();
    expect(getEndpointHeaders).not.toHaveBeenCalled();
    expect(getEndpointProperties).not.toHaveBeenCalled();
  });

  describe("returns endpoint if conditions are true", () => {
    const mockReferenceRecord = { key: "value" };
    const mockEndpointUrl = new URL(mockEndpoint.url);
    const mockUpdatedOptions = {
      ...mockOptions,
      referenceRecord: { ...mockOptions.referenceRecord, ...mockReferenceRecord },
    };

    beforeEach(() => {
      vi.mocked(evaluateConditions).mockReturnValue({
        result: true,
        referenceRecord: mockReferenceRecord,
      });
      vi.mocked(getEndpointUrl).mockReturnValue(mockEndpointUrl);
    });

    afterEach(() => {
      expect(evaluateConditions).toHaveBeenCalledWith(mockConditions, mockOptions);
      expect(getEndpointUrl).toHaveBeenCalledWith(mockEndpoint.url, mockUpdatedOptions);
      vi.clearAllMocks();
    });

    it("without headers and properties", () => {
      const result = evaluateEndpointRule(mockEndpointRule, mockOptions);
      expect(result).toEqual({
        url: mockEndpointUrl,
      });
      expect(getEndpointHeaders).not.toHaveBeenCalled();
      expect(getEndpointProperties).not.toHaveBeenCalled();
      expect(mockLogger.debug).nthCalledWith(
        1,
        `${debugId} Resolving endpoint from template: ${toDebugString(mockEndpointRule.endpoint)}`
      );
    });

    it("with headers and properties", () => {
      const mockInputHeaders = { headerKey: ["headerInputValue"] };
      const mockInputProperties = { propertyKey: "propertyInputValue" };

      const mockOutputHeaders = { headerKey: ["headerOutputValue"] };
      const mockOutputProperties = { propertyKey: "propertyOutputValue" };

      vi.mocked(getEndpointHeaders).mockReturnValue(mockOutputHeaders);
      vi.mocked(getEndpointProperties).mockReturnValue(mockOutputProperties);
      const headerEndpoint = {
        ...mockEndpoint,
        headers: mockInputHeaders,
        properties: mockInputProperties,
      };
      const result = evaluateEndpointRule(
        {
          ...mockEndpointRule,
          endpoint: headerEndpoint,
        },
        mockOptions
      );

      expect(result).toEqual({
        url: mockEndpointUrl,
        headers: mockOutputHeaders,
        properties: mockOutputProperties,
      });
      expect(getEndpointHeaders).toHaveBeenCalledWith(mockInputHeaders, mockUpdatedOptions);
      expect(getEndpointProperties).toHaveBeenCalledWith(mockInputProperties, mockUpdatedOptions);
      expect(mockLogger.debug).nthCalledWith(
        1,
        `${debugId} Resolving endpoint from template: ${toDebugString(headerEndpoint)}`
      );
    });
  });
});
