import type { EndpointRuleObject } from "./EndpointRuleObject";
import type { ErrorRuleObject } from "./ErrorRuleObject";
import type { ConditionObject } from "./shared";

export type RuleSetRules = Array<EndpointRuleObject | ErrorRuleObject | TreeRuleObject>;

export type TreeRuleObject = {
  type: "tree";
  conditions?: ConditionObject[];
  rules: RuleSetRules;
  documentation?: string;
};
