import { describe, expect,test as it, vi } from "vitest";

import { TreeRuleObject } from "../types";
import { evaluateConditions } from "./evaluateConditions";
import { evaluateRules } from "./evaluateRules";
import { evaluateTreeRule } from "./evaluateTreeRule";

vi.mock("./evaluateConditions");
vi.mock("./evaluateRules");

describe(evaluateTreeRule.name, () => {
  const mockOptions = {
    endpointParams: {},
    referenceRecord: {},
  };
  const mockConditions = [
    { fn: "fn1", argv: ["arg1"] },
    { fn: "fn2", argv: ["arg2"] },
  ];
  const mockTreeRule: TreeRuleObject = {
    type: "tree",
    conditions: mockConditions,
    rules: [],
  };

  it("returns undefined if conditions evaluate to false", () => {
    vi.mocked(evaluateConditions).mockReturnValue({ result: false });
    const result = evaluateTreeRule(mockTreeRule, mockOptions);
    expect(result).toBeUndefined();
    expect(evaluateConditions).toHaveBeenCalledWith(mockConditions, mockOptions);
    expect(evaluateRules).not.toHaveBeenCalled();
  });

  it("returns evaluateRules if conditions evaluate to true", () => {
    const mockReferenceRecord = { key: "value" };
    const mockEndpointUrl = new URL("http://example.com");

    vi.mocked(evaluateConditions).mockReturnValue({ result: true, referenceRecord: mockReferenceRecord });
    vi.mocked(evaluateRules).mockReturnValue(mockEndpointUrl);

    const result = evaluateTreeRule(mockTreeRule, mockOptions);
    expect(result).toBe(mockEndpointUrl);
    expect(evaluateConditions).toHaveBeenCalledWith(mockConditions, mockOptions);
    expect(evaluateRules).toHaveBeenCalledWith(mockTreeRule.rules, {
      ...mockOptions,
      referenceRecord: {
        ...mockOptions.referenceRecord,
        ...mockReferenceRecord,
      },
    });
  });
});
