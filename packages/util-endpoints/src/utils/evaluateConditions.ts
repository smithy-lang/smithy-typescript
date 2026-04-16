import { debugId, toDebugString } from "../debug";
import type { ConditionObject, EvaluateOptions, FunctionReturn } from "../types";
import { evaluateCondition } from "./evaluateCondition";

export const evaluateConditions = (conditions: ConditionObject[] = [], options: EvaluateOptions) => {
  const conditionsReferenceRecord: Record<string, FunctionReturn> = {};
  const conditionOptions: EvaluateOptions = {
    ...options,
    referenceRecord: { ...options.referenceRecord },
  };
  let didAssign = false;

  for (const condition of conditions) {
    const { result, toAssign } = evaluateCondition(condition, conditionOptions);

    if (!result) {
      return { result };
    }

    if (toAssign) {
      didAssign = true;
      conditionsReferenceRecord[toAssign.name] = toAssign.value;
      conditionOptions.referenceRecord[toAssign.name] = toAssign.value;
      options.logger?.debug?.(`${debugId} assign: ${toAssign.name} := ${toDebugString(toAssign.value)}`);
    }
  }

  if (didAssign) {
    return { result: true, referenceRecord: conditionsReferenceRecord };
  }

  return { result: true };
};
