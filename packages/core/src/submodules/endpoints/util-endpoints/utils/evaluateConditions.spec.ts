import { afterEach, describe, expect, test as it, vi } from "vitest";

import { debugId, toDebugString } from "../debug";
import type { ConditionObject, EvaluateOptions } from "../types";
import { evaluateCondition } from "./evaluateCondition";
import { evaluateConditions } from "./evaluateConditions";

vi.mock("./evaluateCondition");

describe(evaluateConditions.name, () => {
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
  const mockCn1: ConditionObject = { fn: "fn1", argv: ["arg1"], assign: "assign1" };
  const mockCn2: ConditionObject = { fn: "fn2", argv: ["arg2"], assign: "assign2" };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("returns false as soon as one condition is false", () => {
    it("first condition is false", () => {
      vi.mocked(evaluateCondition).mockReturnValueOnce({ result: false });
      const { result, referenceRecord } = evaluateConditions([mockCn1, mockCn2], mockOptions);
      expect(result).toBe(false);
      expect(referenceRecord).toBeUndefined();
      expect(evaluateCondition).toHaveBeenCalledWith(mockCn1, mockOptions);
    });

    it("second condition is false", () => {
      vi.mocked(evaluateCondition).mockReturnValueOnce({ result: true });
      vi.mocked(evaluateCondition).mockReturnValueOnce({ result: false });
      const { result, referenceRecord } = evaluateConditions([mockCn1, mockCn2], mockOptions);
      expect(result).toBe(false);
      expect(referenceRecord).toBeUndefined();
      expect(evaluateCondition).toHaveBeenNthCalledWith(1, mockCn1, mockOptions);
      expect(evaluateCondition).toHaveBeenNthCalledWith(2, mockCn2, mockOptions);
    });
  });

  it("returns true if all conditions are true with referenceRecord", () => {
    const value1 = "value1";
    const value2 = "value2";

    const capturedReferenceRecords: Record<string, unknown>[] = [];

    vi.mocked(evaluateCondition)
      .mockImplementationOnce((_condition, options) => {
        capturedReferenceRecords.push({ ...options.referenceRecord });
        return { result: true, toAssign: { name: mockCn1.assign!, value: value1 } };
      })
      .mockImplementationOnce((_condition, options) => {
        capturedReferenceRecords.push({ ...options.referenceRecord });
        return { result: true, toAssign: { name: mockCn2.assign!, value: value2 } };
      });

    const { result, referenceRecord } = evaluateConditions([mockCn1, mockCn2], { ...mockOptions });
    expect(result).toBe(true);
    expect(referenceRecord).toEqual({
      [mockCn1.assign!]: value1,
      [mockCn2.assign!]: value2,
    });
    expect(capturedReferenceRecords[0]).toEqual({});
    expect(capturedReferenceRecords[1]).toEqual({ [mockCn1.assign!]: value1 });
    expect(mockLogger.debug).nthCalledWith(1, `${debugId} assign: ${mockCn1.assign} := ${toDebugString(value1)}`);
    expect(mockLogger.debug).nthCalledWith(2, `${debugId} assign: ${mockCn2.assign} := ${toDebugString(value2)}`);
  });

  it("returns true without a referenceRecord if no conditions assign values", () => {
    vi.mocked(evaluateCondition).mockReturnValueOnce({ result: true }).mockReturnValueOnce({ result: true });

    const result = evaluateConditions([mockCn1, mockCn2], mockOptions);

    expect(result).toEqual({ result: true });
    expect(evaluateCondition).toHaveBeenNthCalledWith(1, mockCn1, mockOptions);
    expect(evaluateCondition).toHaveBeenNthCalledWith(2, mockCn2, mockOptions);
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
});
