import { Condition, type EndpointRuleSet, type Rule } from "../../language";
import { TreeMapper } from "./TreeMapper";
import { VariableAnalysis } from "./VariableAnalysis";

/**
 * Drops bindings that no expression references.
 */
export class DeadStoreEliminationTransform extends TreeMapper {
  private constructor(private readonly _analysis: VariableAnalysis) {
    super();
  }

  public static transform(ruleSet: EndpointRuleSet): EndpointRuleSet {
    return new DeadStoreEliminationTransform(VariableAnalysis.analyze(ruleSet)).endpointRuleSet(ruleSet);
  }

  public condition(_rule: Rule, condition: Condition): Condition {
    const result = condition.getResult();
    if (result !== undefined && this._analysis.getReferenceCount(result) === 0) {
      return new Condition(condition.getFunction());
    }
    return condition;
  }
}
