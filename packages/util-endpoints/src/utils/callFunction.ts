import type { EvaluateOptions, Expression, FunctionObject, FunctionReturn } from "../types";
import { customEndpointFunctions } from "./customEndpointFunctions";
import { endpointFunctions } from "./endpointFunctions";
import { evaluateExpression } from "./evaluateExpression";

export const callFunction = ({ fn, argv }: FunctionObject, options: EvaluateOptions): FunctionReturn => {
  const evaluatedArgs = argv.map((arg) =>
    ["boolean", "number"].includes(typeof arg) ? arg : evaluateExpression(arg as Expression, "arg", options)
  );
  const fnSegments = fn.split(".");
  if (fnSegments[0] in customEndpointFunctions && fnSegments[1] != null) {
    // @ts-ignore Element implicitly has an 'any' type
    return customEndpointFunctions[fnSegments[0]][fnSegments[1]](...evaluatedArgs);
  }
  // @ts-ignore Element implicitly has an 'any' type
  return endpointFunctions[fn](...evaluatedArgs);
};
