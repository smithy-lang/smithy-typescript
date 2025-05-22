import { describe, expect, test as it, vi } from "vitest";

import { debugId, toDebugString } from "../debug";
import { EndpointError, EvaluateOptions } from "../types";
import { callFunction } from "./callFunction";
import { evaluateCondition } from "./evaluateCondition";

vi.mock("./callFunction");

describe(evaluateCondition.name, () => {
  const mockOptions: EvaluateOptions = {
    endpointParams: {},
    referenceRecord: {},
  };
  const mockAssign = "mockAssign";
  const mockFnArgs = { fn: "fn", argv: ["arg"] };

  it("throws error if assign is already defined in Reference Record", () => {
    const mockOptionsWithAssign = {
      ...mockOptions,
      referenceRecord: {
        [mockAssign]: true,
      },
    };
    expect(() => evaluateCondition({ assign: mockAssign, ...mockFnArgs }, mockOptionsWithAssign)).toThrow(
      new EndpointError(`'${mockAssign}' is already defined in Reference Record.`)
    );
    expect(callFunction).not.toHaveBeenCalled();
  });

  describe("evaluates function", () => {
    describe.each([
      [true, [true, 1, -1, "true", "false", ""]],
      [false, [false, 0, -0, null, undefined, NaN]],
    ])("returns %s for", (result, testCases) => {
      it.each(testCases)(`value: '%s'`, (mockReturn: any) => {
        const mockLogger = {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };
        vi.mocked(callFunction).mockReturnValue(mockReturn);
        const { result, toAssign } = evaluateCondition(mockFnArgs, { ...mockOptions, logger: mockLogger });
        expect(result).toBe(result);
        expect(toAssign).toBeUndefined();
        expect(mockLogger.debug).nthCalledWith(
          1,
          `${debugId} evaluateCondition: ${toDebugString(mockFnArgs)} = ${mockReturn}`
        );
      });
    });
  });

  it("returns assigned value if defined", () => {
    const mockAssignedValue = "mockAssignedValue";
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.mocked(callFunction).mockReturnValue(mockAssignedValue);
    const { result, toAssign } = evaluateCondition(
      { assign: mockAssign, ...mockFnArgs },
      { ...mockOptions, logger: mockLogger }
    );
    expect(result).toBe(true);
    expect(toAssign).toEqual({ name: mockAssign, value: mockAssignedValue });
    expect(mockLogger.debug).nthCalledWith(
      1,
      `${debugId} evaluateCondition: ${toDebugString(mockFnArgs)} = ${mockAssignedValue}`
    );
  });
});
