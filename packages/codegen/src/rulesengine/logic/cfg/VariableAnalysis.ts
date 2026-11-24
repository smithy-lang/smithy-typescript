import type { Condition } from "../../language";
import {
  type EndpointRuleSet,
  EndpointRule,
  ErrorRule,
  type Expression,
  javaCompare,
  LibraryFunction,
  RecordLiteral,
  Reference,
  type Rule,
  StringLiteral,
  TreeRule,
  TupleLiteral,
} from "../../language";

/**
 * Counts variable bindings and references across a rule set.
 */
export class VariableAnalysis {
  private constructor(
    private readonly _inputParams: Set<string>,
    private readonly _referenceCounts: Map<string, number>,
    private readonly _expressionMappings: Map<string, Map<string, string>>,
    private readonly _variablesNeedingSsa: Set<string>
  ) {}

  public static analyze(ruleSet: EndpointRuleSet): VariableAnalysis {
    const visitor = new AnalysisVisitor();
    for (const rule of ruleSet.getRules()) {
      visitor.visitRule(rule);
    }
    const needsSsa = VariableAnalysis._computeVariablesNeedingSsa(
      visitor.bindings,
      visitor.bindingCounts,
      visitor.bindingReferences
    );
    return new VariableAnalysis(
      new Set(ruleSet.getParameters().names()),
      visitor.referenceCounts,
      VariableAnalysis._createExpressionMappings(visitor.bindings, visitor.bindingCounts, needsSsa),
      needsSsa
    );
  }

  public getInputParams(): Set<string> {
    return this._inputParams;
  }

  public getExpressionMappings(): Map<string, Map<string, string>> {
    return this._expressionMappings;
  }

  public needsSsaRenaming(variableName: string): boolean {
    return this._variablesNeedingSsa.has(variableName);
  }

  public getReferenceCount(variableName: string): number {
    return this._referenceCounts.get(variableName) ?? 0;
  }

  private static _createExpressionMappings(
    bindings: Map<string, Set<string>>,
    bindingCounts: Map<string, number>,
    needsSsa: Set<string>
  ): Map<string, Map<string, string>> {
    const result = new Map<string, Map<string, string>>();
    for (const [varName, expressions] of bindings) {
      const bindingCount = bindingCounts.get(varName) ?? 0;
      result.set(
        varName,
        VariableAnalysis._createMappingForVariable(varName, expressions, bindingCount, needsSsa.has(varName))
      );
    }
    return result;
  }

  private static _computeVariablesNeedingSsa(
    bindings: Map<string, Set<string>>,
    bindingCounts: Map<string, number>,
    bindingReferences: Map<string, Set<string>>
  ): Set<string> {
    const needsSsa = new Set<string>();
    for (const [varName, expressions] of bindings) {
      const bindingCount = bindingCounts.get(varName) ?? 0;
      if (bindingCount > 1 && expressions.size > 1) {
        needsSsa.add(varName);
      }
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const varName of bindings.keys()) {
        if (needsSsa.has(varName)) {
          continue;
        }
        const bindingCount = bindingCounts.get(varName) ?? 0;
        if (bindingCount <= 1) {
          continue;
        }
        const references = bindingReferences.get(varName);
        if (references !== undefined) {
          for (const reference of references) {
            if (needsSsa.has(reference)) {
              needsSsa.add(varName);
              changed = true;
              break;
            }
          }
        }
      }
    }
    return needsSsa;
  }

  private static _createMappingForVariable(
    varName: string,
    expressions: Set<string>,
    bindingCount: number,
    needsSsa: boolean
  ): Map<string, string> {
    const mapping = new Map<string, string>();
    if (bindingCount <= 1 || !needsSsa) {
      const expression = expressions.values().next().value as string;
      mapping.set(expression, varName);
    } else {
      const sortedExpressions = [...expressions].sort(javaCompare);
      for (let i = 0; i < sortedExpressions.length; i++) {
        mapping.set(sortedExpressions[i], varName + "_ssa_" + (i + 1));
      }
    }
    return mapping;
  }
}

class AnalysisVisitor {
  public readonly bindings = new Map<string, Set<string>>();
  public readonly bindingCounts = new Map<string, number>();
  public readonly referenceCounts = new Map<string, number>();
  public readonly bindingReferences = new Map<string, Set<string>>();

  public visitRule(rule: Rule): void {
    for (const condition of rule.getConditions()) {
      this._visitCondition(condition);
    }
    if (rule instanceof TreeRule) {
      for (const nested of rule.getRules()) {
        this.visitRule(nested);
      }
    } else if (rule instanceof EndpointRule) {
      const endpoint = rule.getEndpoint();
      this._countReferences(endpoint.getUrl());
      for (const values of endpoint.getHeaders().values()) {
        for (const value of values) {
          this._countReferences(value);
        }
      }
      for (const property of endpoint.getProperties().values()) {
        this._countReferences(property);
      }
    } else if (rule instanceof ErrorRule) {
      this._countReferences(rule.getError());
    }
  }

  private _visitCondition(condition: Condition): void {
    const result = condition.getResult();
    if (result !== undefined) {
      const fn = condition.getFunction();
      getOrCreate(this.bindings, result).add(fn.toString());
      this.bindingCounts.set(result, (this.bindingCounts.get(result) ?? 0) + 1);
      const references = getOrCreate(this.bindingReferences, result);
      for (const reference of fn.getReferences()) {
        references.add(reference);
      }
    }
    this._countReferences(condition.getFunction());
  }

  private _countReferences(expression: Expression): void {
    if (expression instanceof Reference) {
      const name = expression.getName();
      this.referenceCounts.set(name, (this.referenceCounts.get(name) ?? 0) + 1);
    } else if (expression instanceof StringLiteral) {
      const template = expression.value();
      if (!template.isStatic()) {
        for (const part of template.getParts()) {
          if (part.kind === "dynamic") {
            this._countReferences(part.expression);
          }
        }
      }
    } else if (expression instanceof LibraryFunction) {
      for (const argument of expression.getArguments()) {
        this._countReferences(argument);
      }
    } else if (expression instanceof TupleLiteral) {
      for (const member of expression.members()) {
        this._countReferences(member);
      }
    } else if (expression instanceof RecordLiteral) {
      for (const value of expression.members().values()) {
        this._countReferences(value);
      }
    }
  }
}

const getOrCreate = (map: Map<string, Set<string>>, key: string): Set<string> => {
  let value = map.get(key);
  if (value === undefined) {
    value = new Set();
    map.set(key, value);
  }
  return value;
};
