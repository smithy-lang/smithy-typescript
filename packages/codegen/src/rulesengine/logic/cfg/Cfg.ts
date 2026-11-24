import {
  type Condition,
  EndpointRule,
  type EndpointRuleSet,
  ErrorRule,
  type Parameters,
  type Rule,
  TreeRule,
} from "../../language";
import { CfgBuilder } from "./CfgBuilder";
import { type CfgNode, ConditionNode, ResultNode } from "./CfgNodes";

/**
 * Control flow graph of an endpoint rule set, with shared nodes for repeated rule suffixes.
 */
export class Cfg implements Iterable<CfgNode> {
  private _conditions: Condition[] | undefined;
  private _conditionToIndex: Map<string, number> | undefined;

  public constructor(
    private readonly _parameters: Parameters,
    private readonly _root: CfgNode,
    private readonly _version: string
  ) {}

  public static from(ruleSet: EndpointRuleSet): Cfg {
    const builder = new CfgBuilder(ruleSet);
    const terminal = ResultNode.terminal();
    const processedRules = new Map<Rule, Map<CfgNode, CfgNode>>();
    const root = Cfg._convertRulesToChain(builder.getRuleSet().getRules(), terminal, builder, processedRules);
    const transformed = builder.getRuleSet();
    return new Cfg(transformed.getParameters(), root, transformed.getVersion());
  }

  public getVersion(): string {
    return this._version;
  }

  public getConditions(): Condition[] {
    return this._ensureConditionsExtracted();
  }

  public getParameters(): Parameters {
    return this._parameters;
  }

  public getRoot(): CfgNode {
    return this._root;
  }

  public *[Symbol.iterator](): Iterator<CfgNode> {
    const stack: CfgNode[] = [this._root];
    const visited = new Set<CfgNode>();
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) {
        continue;
      }
      visited.add(node);
      if (node instanceof ConditionNode) {
        stack.push(node.getFalseBranch());
        stack.push(node.getTrueBranch());
      }
      yield node;
    }
  }

  private _ensureConditionsExtracted(): Condition[] {
    if (this._conditions === undefined) {
      const conditions: Condition[] = [];
      const indexMap = new Map<string, number>();
      for (const node of this) {
        if (node instanceof ConditionNode) {
          const condition = node.getCondition().getCondition();
          if (!indexMap.has(condition.key())) {
            indexMap.set(condition.key(), conditions.length);
            conditions.push(condition);
          }
        }
      }
      this._conditions = conditions;
      this._conditionToIndex = indexMap;
    }
    return this._conditions;
  }

  private static _convertRulesToChain(
    rules: Rule[],
    fallthrough: CfgNode,
    builder: CfgBuilder,
    processedRules: Map<Rule, Map<CfgNode, CfgNode>>
  ): CfgNode {
    let next = fallthrough;
    for (let i = rules.length - 1; i >= 0; i--) {
      next = Cfg._convertRule(rules[i], next, builder, processedRules);
    }
    return next;
  }

  private static _convertRule(
    rule: Rule,
    fallthrough: CfgNode,
    builder: CfgBuilder,
    processedRules: Map<Rule, Map<CfgNode, CfgNode>>
  ): CfgNode {
    let byFallthrough = processedRules.get(rule);
    const existing = byFallthrough?.get(fallthrough);
    if (existing !== undefined) {
      return existing;
    }
    let body: CfgNode;
    if (rule instanceof EndpointRule || rule instanceof ErrorRule) {
      body = builder.createResult(rule);
    } else if (rule instanceof TreeRule) {
      body = Cfg._convertRulesToChain(rule.getRules(), fallthrough, builder, processedRules);
    } else {
      throw new Error("Unknown rule type: " + rule.constructor.name);
    }
    let current = body;
    const conditions = rule.getConditions();
    for (let i = conditions.length - 1; i >= 0; i--) {
      current = builder.createCondition(conditions[i], current, fallthrough);
    }
    if (byFallthrough === undefined) {
      byFallthrough = new Map();
      processedRules.set(rule, byFallthrough);
    }
    byFallthrough.set(fallthrough, current);
    return current;
  }
}
