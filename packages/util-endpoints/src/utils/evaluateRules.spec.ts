import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { EndpointError, EndpointRuleObject, ErrorRuleObject, TreeRuleObject } from "../types";
import { evaluateEndpointRule } from "./evaluateEndpointRule";
import { evaluateErrorRule } from "./evaluateErrorRule";
import { evaluateRules } from "./evaluateRules";
import { evaluateTreeRule } from "./evaluateTreeRule";

vi.mock("./evaluateEndpointRule");
vi.mock("./evaluateErrorRule");
vi.mock("./evaluateTreeRule");

describe(evaluateRules.name, () => {
  const mockOptions = {
    endpointParams: {},
    referenceRecord: {},
  };

  const mockConditions = [
    { fn: "fn1", argv: ["arg1"] },
    { fn: "fn2", argv: ["arg2"] },
  ];

  const mockEndpoint = { url: "http://example.com" };
  const mockEndpointRule: EndpointRuleObject = {
    type: "endpoint",
    conditions: mockConditions,
    endpoint: mockEndpoint,
  };

  const mockError = "mockError";
  const mockErrorRule: ErrorRuleObject = {
    type: "error",
    conditions: mockConditions,
    error: mockError,
  };

  const mockTreeRule: TreeRuleObject = {
    type: "tree",
    conditions: mockConditions,
    rules: [],
  };

  const mockEndpointResult = { url: new URL(mockEndpoint.url) };
  const mockRules = [mockEndpointRule, mockErrorRule, mockTreeRule];

  beforeEach(() => {
    vi.mocked(evaluateEndpointRule).mockReturnValue(undefined);
    vi.mocked(evaluateErrorRule).mockReturnValue(undefined);
    vi.mocked(evaluateTreeRule).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("returns endpoint if defined", () => {
    it("from EndPoint Rule", () => {
      vi.mocked(evaluateEndpointRule).mockReturnValue(mockEndpointResult);
      const result = evaluateRules(mockRules, mockOptions);
      expect(result).toEqual(mockEndpointResult);
      expect(evaluateEndpointRule).toHaveBeenCalledWith(mockEndpointRule, mockOptions);
      expect(evaluateErrorRule).not.toHaveBeenCalled();
      expect(evaluateTreeRule).not.toHaveBeenCalled();
    });

    it("from Tree Rule", () => {
      vi.mocked(evaluateTreeRule).mockReturnValue(mockEndpointResult);
      const result = evaluateRules(mockRules, mockOptions);
      expect(result).toEqual(mockEndpointResult);
      expect(evaluateEndpointRule).toHaveBeenCalledWith(mockEndpointRule, mockOptions);
      expect(evaluateErrorRule).toHaveBeenCalledWith(mockErrorRule, mockOptions);
      expect(evaluateTreeRule).toHaveBeenCalledWith(mockTreeRule, mockOptions);
    });
  });

  it("re-throws error from Error Rule, if it occurs before endpoint evaluation", () => {
    const mockError = new Error("mockError");
    vi.mocked(evaluateErrorRule).mockImplementation(() => {
      throw mockError;
    });
    expect(() => evaluateRules(mockRules, mockOptions)).toThrow(mockError);
    expect(evaluateEndpointRule).toHaveBeenCalledWith(mockEndpointRule, mockOptions);
    expect(evaluateErrorRule).toHaveBeenCalledWith(mockErrorRule, mockOptions);
    expect(evaluateTreeRule).not.toHaveBeenCalled();
  });

  it("throws error for unknown endpoint rule", () => {
    const mockUnknownRule = {
      type: "unknown",
      conditions: mockConditions,
      endpoint: mockEndpoint,
    };
    // @ts-ignore: Argument not assignable
    expect(() => evaluateRules([mockUnknownRule], mockOptions)).toThrow(
      new EndpointError(`Unknown endpoint rule: ${mockUnknownRule}`)
    );
    expect(evaluateEndpointRule).not.toHaveBeenCalled();
    expect(evaluateErrorRule).not.toHaveBeenCalled();
    expect(evaluateTreeRule).not.toHaveBeenCalled();
  });

  it("throws error if rules evaluation fails", () => {
    expect(() => evaluateRules(mockRules, mockOptions)).toThrow(new EndpointError(`Rules evaluation failed`));
    expect(evaluateEndpointRule).toHaveBeenCalledWith(mockEndpointRule, mockOptions);
    expect(evaluateErrorRule).toHaveBeenCalledWith(mockErrorRule, mockOptions);
    expect(evaluateTreeRule).toHaveBeenCalledWith(mockTreeRule, mockOptions);
  });
});
