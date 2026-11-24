import type { Expression } from "../../language";
import { Condition, type EndpointRuleSet, type LibraryFunction, Reference, type Rule, TreeRule } from "../../language";
import { TreeMapper } from "./TreeMapper";

/**
 * Merges bindings of the same expression under a single variable name.
 */
export class VariableConsolidationTransform extends TreeMapper {
  private readonly _globalExpressionToVar = new Map<string, string>();
  private readonly _variableRenameMap = new Map<string, string>();
  private readonly _conditionsToEliminate = new Set<Condition>();
  private readonly _ruleDefinedVars = new Map<Rule, Set<string>>();

  public static transform(ruleSet: EndpointRuleSet): EndpointRuleSet {
    const transform = new VariableConsolidationTransform();
    for (const rule of ruleSet.getRules()) {
      transform._collectDefinitions(rule);
    }
    for (const rule of ruleSet.getRules()) {
      transform._discoverBindings(rule, new Map(), new Set());
    }
    return transform.endpointRuleSet(ruleSet);
  }

  public condition(_rule: Rule, condition: Condition): Condition | undefined {
    if (this._conditionsToEliminate.has(condition)) {
      return undefined;
    }
    const fn = condition.getFunction();
    const rewrittenFn = this.libraryFunction(fn);
    const result = condition.getResult();
    if (result !== undefined) {
      const canonicalName = this._variableRenameMap.get(result);
      if (canonicalName !== undefined) {
        return new Condition(rewrittenFn, canonicalName);
      }
    }
    if (rewrittenFn !== fn) {
      return condition.withFunction(rewrittenFn);
    }
    return condition;
  }

  public expression(expression: Expression): Expression {
    for (const reference of expression.getReferences()) {
      if (this._variableRenameMap.has(reference)) {
        return super.expression(expression);
      }
    }
    return expression;
  }

  public reference(reference: Reference): Expression {
    const canonicalName = this._variableRenameMap.get(reference.getName());
    if (canonicalName !== undefined) {
      return new Reference(canonicalName);
    }
    return reference;
  }

  private _collectDefinitions(rule: Rule): void {
    const definedVars = new Set<string>();
    for (const condition of rule.getConditions()) {
      const result = condition.getResult();
      if (result !== undefined) {
        definedVars.add(result);
      }
    }
    this._ruleDefinedVars.set(rule, definedVars);
    if (rule instanceof TreeRule) {
      for (const nested of rule.getRules()) {
        this._collectDefinitions(nested);
      }
    }
  }

  private _discoverBindings(rule: Rule, parentBindings: Map<string, string>, ancestorVars: Set<string>): void {
    const currentBindings = new Map(parentBindings);
    const visibleAncestorVars = new Set(ancestorVars);
    for (const condition of rule.getConditions()) {
      const varName = condition.getResult();
      if (varName === undefined) {
        continue;
      }
      const canonical = (condition.getFunction().canonicalize() as LibraryFunction).toString();
      const parentVar = parentBindings.get(canonical);
      if (parentVar !== undefined) {
        this._variableRenameMap.set(varName, parentVar);
        this._conditionsToEliminate.add(condition);
      } else {
        currentBindings.set(canonical, varName);
        visibleAncestorVars.add(varName);
        const globalVar = this._globalExpressionToVar.get(canonical);
        if (globalVar !== undefined && globalVar !== varName) {
          if (!this._wouldCauseShadowing(globalVar, rule, ancestorVars)) {
            this._variableRenameMap.set(varName, globalVar);
          }
        } else if (globalVar === undefined) {
          this._globalExpressionToVar.set(canonical, varName);
        }
      }
    }
    if (rule instanceof TreeRule) {
      for (const nested of rule.getRules()) {
        this._discoverBindings(nested, currentBindings, visibleAncestorVars);
      }
    }
  }

  private _wouldCauseShadowing(varName: string, currentRule: Rule, ancestorVars: Set<string>): boolean {
    if (ancestorVars.has(varName)) {
      return true;
    }
    return this._wouldShadowInDescendants(varName, currentRule);
  }

  private _wouldShadowInDescendants(varName: string, rule: Rule): boolean {
    if (rule instanceof TreeRule) {
      for (const nested of rule.getRules()) {
        const nestedVars = this._ruleDefinedVars.get(nested);
        if (nestedVars !== undefined && nestedVars.has(varName)) {
          return true;
        }
        if (this._wouldShadowInDescendants(varName, nested)) {
          return true;
        }
      }
    }
    return false;
  }
}
