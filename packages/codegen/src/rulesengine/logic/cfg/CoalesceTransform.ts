import {
  Coalesce,
  Condition,
  type EndpointRuleSet,
  type Expression,
  IsSet,
  type LibraryFunction,
  OptionalType,
  RecordType,
  type Rule,
  TreeRule,
} from "../../language";
import { TreeMapper } from "./TreeMapper";

/**
 * Fuses a binding with the condition that uses it once into a single coalesce expression.
 */
export class CoalesceTransform {
  private readonly _coalesceCache = new Map<string, Condition>();

  public static transform(ruleSet: EndpointRuleSet): EndpointRuleSet {
    const transform = new CoalesceTransform();
    const transformedRules: Rule[] = [];
    for (const rule of ruleSet.getRules()) {
      transformedRules.push(transform._transformRule(rule));
    }
    return ruleSet.withRules(transformedRules);
  }

  private _transformRule(rule: Rule): Rule {
    const localVarUsage = new Map<string, number>();
    for (const condition of rule.getConditions()) {
      for (const reference of condition.getFunction().getReferences()) {
        localVarUsage.set(reference, (localVarUsage.get(reference) ?? 0) + 1);
      }
    }
    const eliminatedConditions = new Set<string>();
    const transformedConditions = this._transformConditions(rule.getConditions(), eliminatedConditions, localVarUsage);
    if (rule instanceof TreeRule) {
      const transformedNested = rule.getRules().map((nested) => this._transformRule(nested));
      return new TreeRule(transformedConditions, transformedNested, rule.getDocumentation());
    }
    return rule.withConditions(transformedConditions);
  }

  private _transformConditions(
    conditions: Condition[],
    eliminatedConditions: Set<string>,
    localVarUsage: Map<string, number>
  ): Condition[] {
    const result: Condition[] = [];
    for (let i = 0; i < conditions.length; i++) {
      const current = conditions[i];
      if (eliminatedConditions.has(current.key())) {
        continue;
      }
      const variable = current.getResult();
      if (i + 1 < conditions.length && variable !== undefined) {
        const next = conditions[i + 1];
        if (CoalesceTransform._canCoalesce(variable, current, next, localVarUsage)) {
          result.push(this._createCoalescedCondition(current, next, variable));
          eliminatedConditions.add(current.key());
          eliminatedConditions.add(next.key());
          i++;
          continue;
        }
      }
      result.push(current);
    }
    return result;
  }

  private static _canCoalesce(
    variable: string,
    bind: Condition,
    use: Condition,
    localVarUsage: Map<string, number>
  ): boolean {
    if (!use.getFunction().getReferences().has(variable)) {
      return false;
    }
    if (use.getFunction().getFunctionDefinition() === IsSet.getDefinition()) {
      return false;
    }
    const localUses = localVarUsage.get(variable);
    if (localUses === undefined || localUses > 1) {
      return false;
    }
    const type = bind.getFunction().getFunctionDefinition().getReturnType();
    const innerType = type instanceof OptionalType ? type.inner() : type;
    if (innerType instanceof RecordType) {
      return false;
    }
    return innerType.getZeroValue() !== undefined;
  }

  private _createCoalescedCondition(bind: Condition, use: Condition, variable: string): Condition {
    const bindExpr = bind.getFunction();
    const useExpr = use.getFunction();
    const type = bindExpr.getFunctionDefinition().getReturnType();
    const innerType = type instanceof OptionalType ? type.inner() : type;
    const zero = innerType.getZeroValue()!;
    const key = JSON.stringify([
      bindExpr.canonicalize().toString(),
      zero.toString(),
      useExpr.canonicalize().toString(),
      variable,
      use.getResult() ?? "",
    ]);
    const cached = this._coalesceCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const coalesced = Coalesce.ofExpressions(bindExpr, zero);
    const replacements = new Map<string, Expression>([[variable, coalesced]]);
    const replaced = TreeMapper.newReferenceReplacingMapper(replacements).expression(useExpr);
    const canonicalized = (replaced as LibraryFunction).canonicalize();
    const result = new Condition(canonicalized, use.getResult());
    this._coalesceCache.set(key, result);
    return result;
  }
}
