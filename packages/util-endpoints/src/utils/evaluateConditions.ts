import { debugId, toDebugString } from "../debug";
import type { ConditionObject, EvaluateOptions, FunctionReturn } from "../types";
import { evaluateCondition } from "./evaluateCondition";

export const evaluateConditions = (conditions: ConditionObject[] = [], options: EvaluateOptions) => {
  let conditionOptions = options;
  let conditionsReferenceRecord: Record<string, FunctionReturn> | undefined;

  for (const condition of conditions) {
    const { result, toAssign } = evaluateCondition(condition, conditionOptions);

    if (!result) {
      return { result };
    }

    if (toAssign) {
      if (!conditionsReferenceRecord) {
        conditionsReferenceRecord = {};
        conditionOptions = {
          ...options,
          referenceRecord: { ...options.referenceRecord },
        };
      }
      conditionsReferenceRecord[toAssign.name] = toAssign.value;
      conditionOptions.referenceRecord[toAssign.name] = toAssign.value;
      options.logger?.debug?.(`${debugId} assign: ${toAssign.name} := ${toDebugString(toAssign.value)}`);
    }
  }

  return conditionsReferenceRecord ? { result: true, referenceRecord: conditionsReferenceRecord } : { result: true };
};
