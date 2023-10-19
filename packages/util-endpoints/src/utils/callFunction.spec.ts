import { callFunction } from "./callFunction";
import { customEndpointFunctions } from "./customEndpointFunctions";
import { endpointFunctions } from "./endpointFunctions";
import { evaluateExpression } from "./evaluateExpression";

jest.mock("./evaluateExpression");

describe(callFunction.name, () => {
  const mockOptions = {
    endpointParams: {},
    referenceRecord: {},
  };
  const mockReturn = "mockReturn";
  const mockArgReturn = "mockArgReturn";

  beforeEach(() => {
    (evaluateExpression as jest.Mock).mockReturnValue(mockArgReturn);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    "booleanEquals",
    "getAttr",
    "isSet",
    "isValidHostLabel",
    "not",
    "parseURL",
    "stringEquals",
    "subsgtring",
    "urlEncode",
  ])("calls built-in endpoint function %s", (builtIn) => {
    endpointFunctions[builtIn] = jest.fn().mockReturnValue(mockReturn);
    const mockArg = "mockArg";
    const mockFn = { fn: builtIn, argv: [mockArg] };

    const result = callFunction(mockFn, mockOptions);
    expect(result).toBe(mockReturn);
    expect(endpointFunctions[builtIn]).toHaveBeenCalledWith(mockArgReturn);
  });

  it.each([
    ["boolean", true],
    ["boolean", false],
    ["number", 1],
    ["number", 0],
  ])("skips evaluateExpression for %s arg: %s", (argType, mockNotExpressionArg) => {
    const mockFn = { fn: "booleanEquals", argv: [mockNotExpressionArg] };
    const result = callFunction(mockFn, mockOptions);
    expect(result).toBe(mockReturn);
    expect(evaluateExpression).not.toHaveBeenCalled();
    expect(endpointFunctions.booleanEquals).toHaveBeenCalledWith(mockNotExpressionArg);
  });

  it.each(["string", { ref: "ref" }, { fn: "fn", argv: [] }])(
    "calls evaluateExpression for expression arg: %s",
    (arg) => {
      const mockFn = { fn: "booleanEquals", argv: [arg] };

      const result = callFunction(mockFn, mockOptions);
      expect(result).toBe(mockReturn);
      expect(evaluateExpression).toHaveBeenCalledWith(arg, "arg", mockOptions);
      expect(endpointFunctions.booleanEquals).toHaveBeenCalledWith(mockArgReturn);
    }
  );

  it("calls custom endpoint functions", () => {
    const mockCustomFunction = jest.fn().mockReturnValue(mockReturn);
    customEndpointFunctions["ns"] = {
      mockCustomFunction,
    };
    const mockArg = "mockArg";
    const mockFn = { fn: `ns.mockCustomFunction`, argv: [mockArg] };

    const result = callFunction(mockFn, mockOptions);
    expect(result).toBe(mockReturn);
    expect(evaluateExpression).toHaveBeenCalledWith(mockArg, "arg", mockOptions);
    expect(mockCustomFunction).toHaveBeenCalledWith(mockArgReturn);
  });
});
