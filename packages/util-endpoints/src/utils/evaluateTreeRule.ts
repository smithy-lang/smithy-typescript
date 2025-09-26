import type { EndpointV2 } from "@smithy/types";

import type { EvaluateOptions, TreeRuleObject } from "../types";
import { evaluateConditions } from "./evaluateConditions";
import { evaluateRules } from "./evaluateRules";

export const evaluateTreeRule = (treeRule: TreeRuleObject, options: EvaluateOptions): EndpointV2 | undefined => {
  const { conditions, rules } = treeRule;

  const { result, referenceRecord } = evaluateConditions(conditions, options);
  if (!result) {
    return;
  }

  return evaluateRules(rules, {
    ...options,
    referenceRecord: { ...options.referenceRecord, ...referenceRecord },
  });
};
