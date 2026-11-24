import {
  BooleanEquals,
  Coalesce,
  Condition,
  EndpointRuleSet,
  Expression,
  IsSet,
  Literal,
  Reference,
  type Rule,
} from "../../language";
import { TreeMapper } from "./TreeMapper";

/**
 * Collapses an isSet check followed by a boolean comparison of the same reference into one coalesce condition.
 */
export class IsSetBooleanCoalesceTransform extends TreeMapper {
  public static transform(ruleSet: EndpointRuleSet): EndpointRuleSet {
    const transform = new IsSetBooleanCoalesceTransform();
    const transformedRules: Rule[] = [];
    for (const rule of ruleSet.getRules()) {
      transformedRules.push(transform.rule(rule)!);
    }
    return EndpointRuleSet.fromNode(ruleSet.withRules(transformedRules).toNode());
  }

  public conditions(_rule: Rule, conditions: Condition[]): Condition[] {
    const result: Condition[] = [];
    const size = conditions.length;
    for (let i = 0; i < size; i++) {
      const current = conditions[i];
      if (i + 1 < size && current.getResult() === undefined && current.getFunction() instanceof IsSet) {
        const isSetArgument = current.getFunction().getArguments()[0];
        if (isSetArgument instanceof Reference) {
          const coalesced = IsSetBooleanCoalesceTransform._tryCoalesce(isSetArgument, conditions[i + 1]);
          if (coalesced !== undefined) {
            result.push(coalesced);
            i++;
            continue;
          }
        }
      }
      result.push(current);
    }
    return result;
  }

  private static _tryCoalesce(isSetReference: Reference, next: Condition): Condition | undefined {
    if (next.getResult() !== undefined) {
      return undefined;
    }
    const fn = next.getFunction();
    if (!(fn instanceof BooleanEquals)) {
      return undefined;
    }
    const [arg1, arg2] = fn.getArguments();
    if (!(arg1 instanceof Reference) || arg1.getName() !== isSetReference.getName()) {
      return undefined;
    }
    if (!(arg2 instanceof Literal)) {
      return undefined;
    }
    const literalValue = arg2.asBooleanLiteral();
    if (literalValue === undefined) {
      return undefined;
    }
    const freshReference = new Reference(isSetReference.getName());
    const coalesced = Coalesce.ofExpressions(freshReference, Expression.of(!literalValue));
    return new Condition(BooleanEquals.ofExpressions(coalesced, literalValue));
  }
}
