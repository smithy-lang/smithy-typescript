import { Condition, type EndpointRuleSet, type Expression, Reference, type Rule } from "../../language";
import { CoalesceTransform } from "./CoalesceTransform";
import { DeadStoreEliminationTransform } from "./DeadStoreEliminationTransform";
import { IsSetBooleanCoalesceTransform } from "./IsSetBooleanCoalesceTransform";
import { SyntheticBindingTransform } from "./SyntheticBindingTransform";
import { TreeMapper } from "./TreeMapper";
import { VariableAnalysis } from "./VariableAnalysis";
import { VariableConsolidationTransform } from "./VariableConsolidationTransform";

/**
 * Renames variables so that each binding name maps to one expression, after the other normalizing transforms.
 */
export class SsaTransform extends TreeMapper {
  private readonly _scopeStack: Array<Map<string, string>> = [];
  private readonly _ssaNameToRewrittenExpr = new Map<string, string>();
  private readonly _ssaCounters = new Map<string, number>();

  private constructor(private readonly _analysis: VariableAnalysis) {
    super();
    const initialScope = new Map<string, string>();
    for (const param of _analysis.getInputParams()) {
      initialScope.set(param, param);
    }
    this._scopeStack.push(initialScope);
  }

  public static transform(ruleSet: EndpointRuleSet): EndpointRuleSet {
    let transformed = IsSetBooleanCoalesceTransform.transform(ruleSet);
    transformed = SyntheticBindingTransform.transform(transformed);
    transformed = VariableConsolidationTransform.transform(transformed);
    transformed = DeadStoreEliminationTransform.transform(transformed);
    transformed = CoalesceTransform.transform(transformed);
    return new SsaTransform(VariableAnalysis.analyze(transformed)).endpointRuleSet(transformed);
  }

  public rule(rule: Rule): Rule | undefined {
    this._scopeStack.push(new Map(this._peekScope()));
    try {
      return super.rule(rule);
    } finally {
      this._scopeStack.pop();
    }
  }

  public condition(_rule: Rule, condition: Condition): Condition {
    const fn = condition.getFunction();
    let uniqueBindingName: string | undefined;
    let needsUniqueBinding = false;
    let varName: string | undefined;
    const result = condition.getResult();
    if (result !== undefined) {
      varName = result;
      if (this._analysis.needsSsaRenaming(varName)) {
        const expressionMap = this._analysis.getExpressionMappings().get(varName);
        if (expressionMap !== undefined) {
          uniqueBindingName = expressionMap.get(fn.toString());
          needsUniqueBinding = uniqueBindingName !== undefined && uniqueBindingName !== varName;
        }
      }
    }
    if (this._doesNotNeedRewriting(fn.getReferences()) && !needsUniqueBinding) {
      return condition;
    }
    const rewrittenFn = this.libraryFunction(fn);
    const fnChanged = rewrittenFn !== fn;
    if (needsUniqueBinding) {
      const rewrittenExpr = rewrittenFn.toString();
      const previousExpr = this._ssaNameToRewrittenExpr.get(uniqueBindingName!);
      if (previousExpr === undefined) {
        this._ssaNameToRewrittenExpr.set(uniqueBindingName!, rewrittenExpr);
      } else if (previousExpr !== rewrittenExpr) {
        do {
          const counter = (this._ssaCounters.get(varName!) ?? 0) + 1;
          this._ssaCounters.set(varName!, counter);
          uniqueBindingName = varName + "_ssa_" + counter;
        } while (this._ssaNameToRewrittenExpr.has(uniqueBindingName));
        this._ssaNameToRewrittenExpr.set(uniqueBindingName, rewrittenExpr);
      }
    }
    if (result !== undefined && uniqueBindingName !== undefined) {
      this._bindVariable(result, uniqueBindingName);
      if (needsUniqueBinding || fnChanged) {
        return new Condition(rewrittenFn, uniqueBindingName);
      }
    } else if (fnChanged) {
      return condition.withFunction(rewrittenFn);
    }
    return condition;
  }

  public expression(expression: Expression): Expression {
    return this._doesNotNeedRewriting(expression.getReferences()) ? expression : super.expression(expression);
  }

  public reference(reference: Reference): Expression {
    const originalName = reference.getName();
    const uniqueName = this._peekScope().get(originalName) ?? originalName;
    if (uniqueName === originalName) {
      return reference;
    }
    return new Reference(uniqueName);
  }

  private _peekScope(): Map<string, string> {
    return this._scopeStack[this._scopeStack.length - 1];
  }

  private _bindVariable(oldName: string, newName: string): void {
    const scope = this._peekScope();
    const existing = scope.get(oldName);
    scope.set(oldName, newName);
    if (existing !== undefined && existing !== oldName) {
      throw new Error("Cannot shadow variable: " + oldName + ", conflicts with " + existing);
    }
  }

  private _doesNotNeedRewriting(references: ReadonlySet<string>): boolean {
    const scope = this._peekScope();
    for (const reference of references) {
      if (reference !== (scope.get(reference) ?? reference)) {
        return false;
      }
    }
    return true;
  }
}
