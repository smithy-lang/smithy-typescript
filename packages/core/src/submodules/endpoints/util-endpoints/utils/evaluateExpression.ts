import {
  EndpointError,
  type EvaluateOptions,
  type Expression,
  type FunctionObject,
  type FunctionReturn,
  type ReferenceObject,
} from "../types";
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
  const evaluatedArgs = Array(argv.length);

  // manual mapping - hot code path.
  for (let i = 0; i < evaluatedArgs.length; ++i) {
    const arg = argv[i];
    if (typeof arg === "boolean" || typeof arg === "number") {
      evaluatedArgs[i] = arg;
    } else {
      evaluatedArgs[i] = group.evaluateExpression(arg, "arg", options);
    }
  }

  const namespaceSeparatorIndex = fn.indexOf(".");
  if (namespaceSeparatorIndex !== -1) {
    const namespaceFunctions = customEndpointFunctions[fn.slice(0, namespaceSeparatorIndex)];
    const customFunction = namespaceFunctions?.[fn.slice(namespaceSeparatorIndex + 1)];
    if (typeof customFunction === "function") {
      return customFunction(...evaluatedArgs);
    }
  }

  const callable = endpointFunctions[fn as keyof typeof endpointFunctions];
  if (typeof callable === "function") {
    return callable(...evaluatedArgs);
  }

  throw new Error(`function ${fn} not loaded in endpointFunctions.`);
};

export const group = {
  evaluateExpression,
  callFunction,
};
