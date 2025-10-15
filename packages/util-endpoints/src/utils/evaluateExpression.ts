import type { EvaluateOptions, Expression, FunctionObject, FunctionReturn, ReferenceObject } from "../types";
import { EndpointError } from "../types";
import { customEndpointFunctions } from "./customEndpointFunctions";
import { endpointFunctions } from "./endpointFunctions";
import { evaluateTemplate } from "./evaluateTemplate";
import { getReferenceValue } from "./getReferenceValue";

export const evaluateExpression = (obj: Expression, keyName: string, options: EvaluateOptions) => {
  if (typeof obj === "string") {
    return evaluateTemplate(obj, options);
  } else if ((obj as FunctionObject)["fn"]) {
    return group.callFunction(obj as FunctionObject, options);
  } else if ((obj as ReferenceObject)["ref"]) {
    return getReferenceValue(obj as ReferenceObject, options);
  }
  throw new EndpointError(`'${keyName}': ${String(obj)} is not a string, function or reference.`);
};

export const callFunction = ({ fn, argv }: FunctionObject, options: EvaluateOptions): FunctionReturn => {
  const evaluatedArgs = argv.map((arg) =>
    ["boolean", "number"].includes(typeof arg) ? arg : group.evaluateExpression(arg as Expression, "arg", options)
  );
  const fnSegments = fn.split(".");
  if (fnSegments[0] in customEndpointFunctions && fnSegments[1] != null) {
    // @ts-ignore Element implicitly has an 'any' type
    return customEndpointFunctions[fnSegments[0]][fnSegments[1]](...evaluatedArgs);
  }
  // @ts-ignore Element implicitly has an 'any' type
  return endpointFunctions[fn](...evaluatedArgs);
};

export const group = {
  evaluateExpression,
  callFunction,
};
