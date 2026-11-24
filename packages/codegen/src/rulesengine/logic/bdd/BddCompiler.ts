import { type Condition, NoMatchRule, type Rule } from "../../language";
import type { Cfg } from "../cfg/Cfg";
import { type CfgNode, type ConditionNode, ResultNode } from "../cfg/CfgNodes";
import type { Bdd } from "./Bdd";
import { BddBuilder } from "./BddBuilder";
import { InitialOrdering } from "./InitialOrdering";
import type { OrderingStrategy } from "./OrderingStrategy";

/**
 * Converts a CFG into a BDD for a given condition ordering.
 */
export class BddCompiler {
  private readonly _cfg: Cfg;
  private readonly _bddBuilder: BddBuilder;
  private readonly _orderingStrategy: OrderingStrategy;
  private _orderedConditions: Condition[] = [];
  private _conditionToIndex = new Map<string, number>();
  private readonly _ruleToIndex = new Map<string, number>();
  private readonly _indexedResults: Rule[] = [];
  private _nextResultIndex = 0;
  private _noMatchIndex = -1;
  private readonly _nodeCache = new Map<CfgNode, number>();

  public constructor(cfg: Cfg, orderingStrategy?: OrderingStrategy, bddBuilder?: BddBuilder) {
    this._cfg = cfg;
    this._orderingStrategy = orderingStrategy ?? new InitialOrdering(cfg);
    this._bddBuilder = bddBuilder ?? new BddBuilder();
  }

  public compile(): Bdd {
    this._orderedConditions = this._orderingStrategy.orderConditions(this._cfg.getConditions());
    this._conditionToIndex = new Map();
    for (let i = 0; i < this._orderedConditions.length; i++) {
      this._conditionToIndex.set(this._orderedConditions[i].key(), i);
    }
    this._bddBuilder.setConditionCount(this._orderedConditions.length);
    this._noMatchIndex = this._getOrCreateResultIndex(NoMatchRule.INSTANCE);
    let rootRef = this._convertCfgToBdd(this._cfg.getRoot());
    rootRef = this._bddBuilder.reduce(rootRef);
    this._bddBuilder.setRoot(rootRef);
    this._bddBuilder.setResultCount(this._indexedResults.length);
    return this._bddBuilder.build();
  }

  public getIndexedResults(): Rule[] {
    return this._indexedResults;
  }

  public getOrderedConditions(): Condition[] {
    return this._orderedConditions;
  }

  private _convertCfgToBdd(cfgNode: CfgNode): number {
    const cached = this._nodeCache.get(cfgNode);
    if (cached !== undefined) {
      return cached;
    }
    let result: number;
    if (cfgNode instanceof ResultNode) {
      result = this._bddBuilder.makeResult(this._getOrCreateResultIndex(cfgNode.getResult()));
    } else {
      const conditionNode = cfgNode as ConditionNode;
      const reference = conditionNode.getCondition();
      const variableIndex = this._conditionToIndex.get(reference.getCondition().key())!;
      let hi = this._convertCfgToBdd(conditionNode.getTrueBranch());
      let lo = this._convertCfgToBdd(conditionNode.getFalseBranch());
      if (reference.isNegated()) {
        const tmp = hi;
        hi = lo;
        lo = tmp;
      }
      const test = this._bddBuilder.makeNode(variableIndex, this._bddBuilder.makeTrue(), this._bddBuilder.makeFalse());
      result = this._bddBuilder.ite(test, hi, lo);
    }
    this._nodeCache.set(cfgNode, result);
    return result;
  }

  private _getOrCreateResultIndex(rule: Rule): number {
    const key = rule.key();
    let index = this._ruleToIndex.get(key);
    if (index === undefined) {
      index = this._nextResultIndex++;
      this._ruleToIndex.set(key, index);
      this._indexedResults.push(rule);
    }
    return index;
  }
}
