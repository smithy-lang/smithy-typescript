import {
  BooleanEquals,
  Condition,
  type EndpointRuleSet,
  IsSet,
  LibraryFunction,
  Literal,
  Not,
  type Rule,
} from "../../language";
import { type CfgNode, ConditionNode, ConditionReference, ResultNode } from "./CfgNodes";
import { SsaTransform } from "./SsaTransform";

/**
 * Builds a deduplicated CFG, canonicalizing conditions and negations as it goes.
 */
export class CfgBuilder {
  private readonly _ruleSet: EndpointRuleSet;
  private readonly _nodeCache = new Map<string, CfgNode>();
  private readonly _nodeIds = new Map<CfgNode, number>();
  private readonly _conditionToReference = new Map<string, ConditionReference>();
  private readonly _resultCache = new Map<string, Rule>();
  private readonly _resultNodeCache = new Map<string, ResultNode>();
  private readonly _functionBindings = new Map<string, Condition>();

  public constructor(ruleSet: EndpointRuleSet) {
    this._ruleSet = SsaTransform.transform(ruleSet);
  }

  public getRuleSet(): EndpointRuleSet {
    return this._ruleSet;
  }

  public createCondition(condition: Condition, trueBranch: CfgNode, falseBranch: CfgNode): CfgNode {
    const reference = this.createConditionReference(condition);
    const signature = `${reference.key()}|${this._nodeId(trueBranch)}|${this._nodeId(falseBranch)}`;
    let node = this._nodeCache.get(signature);
    if (node === undefined) {
      node = new ConditionNode(reference, trueBranch, falseBranch);
      this._nodeCache.set(signature, node);
    }
    return node;
  }

  public createResult(rule: Rule): CfgNode {
    const interned = this._intern(rule);
    const key = interned.key();
    let node = this._resultNodeCache.get(key);
    if (node === undefined) {
      node = new ResultNode(interned);
      this._resultNodeCache.set(key, node);
    }
    return node;
  }

  public createConditionReference(condition: Condition): ConditionReference {
    const cached = this._conditionToReference.get(condition.key());
    if (cached !== undefined) {
      return cached;
    }
    let negated = false;
    let canonical = condition;
    if (CfgBuilder._isNegationWrapper(condition)) {
      negated = true;
      canonical = CfgBuilder._unwrapNegation(condition);
      const existing = this._conditionToReference.get(canonical.key());
      if (existing !== undefined) {
        const negatedReference = existing.negate();
        this._conditionToReference.set(condition.key(), negatedReference);
        return negatedReference;
      }
    }
    canonical = canonical.canonicalize();
    const beforeBooleanCanon = canonical;
    canonical = CfgBuilder._canonicalizeBooleanEquals(canonical);
    if (!canonical.equals(beforeBooleanCanon)) {
      negated = !negated;
    }
    canonical = this._consolidateIsSetWithBinding(canonical);
    canonical = Condition.fromNode(canonical.toNode());
    if (canonical.getResult() !== undefined) {
      const functionKey = canonical.getFunction().toString();
      if (!this._functionBindings.has(functionKey)) {
        this._functionBindings.set(functionKey, canonical);
      }
    }
    const reference = new ConditionReference(canonical, negated);
    this._conditionToReference.set(condition.key(), reference);
    if (!negated && !condition.equals(canonical)) {
      this._conditionToReference.set(canonical.key(), reference);
    }
    return reference;
  }

  private _nodeId(node: CfgNode): number {
    let id = this._nodeIds.get(node);
    if (id === undefined) {
      id = this._nodeIds.size;
      this._nodeIds.set(node, id);
    }
    return id;
  }

  private _intern(rule: Rule): Rule {
    const canonical = rule.withConditions([]);
    const key = canonical.key();
    let existing = this._resultCache.get(key);
    if (existing === undefined) {
      existing = canonical;
      this._resultCache.set(key, existing);
    }
    return existing;
  }

  private _consolidateIsSetWithBinding(condition: Condition): Condition {
    if (!(condition.getFunction() instanceof IsSet) || condition.getResult() !== undefined) {
      return condition;
    }
    const inner = condition.getFunction().getArguments()[0];
    if (!(inner instanceof LibraryFunction)) {
      return condition;
    }
    return this._functionBindings.get(inner.toString()) ?? condition;
  }

  private static _canonicalizeBooleanEquals(condition: Condition): Condition {
    if (!(condition.getFunction() instanceof BooleanEquals)) {
      return condition;
    }
    const args = condition.getFunction().getArguments();
    if (args.length !== 2 || !(args[1] instanceof Literal)) {
      return condition;
    }
    const literalValue = args[1].asBooleanLiteral();
    if (literalValue !== undefined && !literalValue) {
      return condition.withFunction(BooleanEquals.ofExpressions(args[0], true));
    }
    return condition;
  }

  private static _isNegationWrapper(condition: Condition): boolean {
    return (
      condition.getFunction() instanceof Not &&
      condition.getResult() === undefined &&
      condition.getFunction().getArguments()[0] instanceof LibraryFunction
    );
  }

  private static _unwrapNegation(negatedCondition: Condition): Condition {
    return negatedCondition.withFunction(negatedCondition.getFunction().getArguments()[0] as LibraryFunction);
  }
}
