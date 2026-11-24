import type { Condition } from "../../language";
import type { EndpointBddTrait } from "../../traits/EndpointBddTrait";
import type { Cfg } from "../cfg/Cfg";
import { ConditionDependencyGraph, type OrderConstraints } from "../cfg/ConditionDependencyGraph";
import { type ConditionCostModel, DefaultConditionCostModel } from "../ConditionCostModel";
import type { Bdd } from "./Bdd";
import { BddBuilder } from "./BddBuilder";
import { BddCompilerSupport } from "./BddCompilerSupport";
import { BddCostEstimator } from "./BddCostEstimator";

interface CostOptimizationOptions {
  cfg: Cfg;
  costModel?: ConditionCostModel;
  trueProbability?: (condition: Condition) => number;
  maxAllowedGrowth?: number;
  maxRounds?: number;
  topK?: number;
}

/**
 * Reorders conditions to lower the expected evaluation cost without growing the BDD much.
 */
export class CostOptimization {
  private readonly _cfg: Cfg;
  private readonly _costModel: ConditionCostModel;
  private readonly _trueProbability: ((condition: Condition) => number) | undefined;
  private readonly _dependencyGraph: ConditionDependencyGraph;
  private readonly _builder = new BddBuilder();
  private readonly _maxAllowedGrowth: number;
  private readonly _maxRounds: number;
  private readonly _topK: number;

  public constructor(options: CostOptimizationOptions) {
    this._cfg = options.cfg;
    this._costModel = options.costModel ?? new DefaultConditionCostModel();
    this._trueProbability = options.trueProbability;
    this._maxAllowedGrowth = options.maxAllowedGrowth ?? 0.08;
    this._maxRounds = options.maxRounds ?? 30;
    this._topK = options.topK ?? 50;
    this._dependencyGraph = new ConditionDependencyGraph(this._cfg.getConditions());
  }

  public apply(trait: EndpointBddTrait): EndpointBddTrait {
    const state = this._createState(trait);
    const estimator = new BddCostEstimator(trait.getConditions(), this._costModel, this._trueProbability);
    for (let round = 0; round < this._maxRounds; round++) {
      const bestMove = this._findBestMove(state, estimator);
      if (bestMove === undefined) {
        break;
      }
      this._applyMove(state, bestMove[0], bestMove[1], estimator);
      this._polish(state, estimator);
    }
    const finalResult = BddCompilerSupport.compile(this._cfg, state.order, this._builder);
    return trait.withOrdering(state.order, finalResult.results, finalResult.bdd);
  }

  private _createState(trait: EndpointBddTrait): State {
    const conditions = trait.getConditions();
    const bdd = trait.getBdd();
    const baselineNodes = BddCompilerSupport.nodeCount(bdd);
    const estimator = new BddCostEstimator(conditions, this._costModel, this._trueProbability);
    const initialCost = estimator.expectedCost(bdd, conditions);
    return {
      order: [...conditions],
      bdd,
      constraints: this._dependencyGraph.createOrderConstraints(conditions),
      maxNodes: baselineNodes + Math.trunc(baselineNodes * this._maxAllowedGrowth),
      currentCost: initialCost,
    };
  }

  private _findBestMove(state: State, estimator: BddCostEstimator): [number, number] | undefined {
    const hotPositions = this._getHotPositions(state.bdd, state.order, estimator, this._topK);
    const seen = new Array<boolean>(state.order.length).fill(false);
    let bestCost = state.currentCost;
    let bestFrom = -1;
    let bestTo = -1;
    for (const hotPos of hotPositions) {
      const targets = CostOptimization._buildTargets(hotPos, state.constraints, seen);
      for (const target of targets) {
        if (!state.constraints.canMove(hotPos, target)) {
          continue;
        }
        const candidate = [...state.order];
        BddCompilerSupport.move(candidate, hotPos, target);
        const result = this._evaluateCandidate(candidate, state, estimator);
        if (result !== undefined && result.cost < bestCost) {
          bestCost = result.cost;
          bestFrom = hotPos;
          bestTo = target;
        }
      }
    }
    return bestFrom >= 0 ? [bestFrom, bestTo] : undefined;
  }

  private _evaluateCandidate(
    candidate: Condition[],
    state: State,
    estimator: BddCostEstimator
  ): { bdd: Bdd; cost: number } | undefined {
    const result = BddCompilerSupport.compile(this._cfg, candidate, this._builder);
    if (BddCompilerSupport.nodeCount(result.bdd) > state.maxNodes) {
      return undefined;
    }
    return { bdd: result.bdd, cost: estimator.expectedCost(result.bdd, candidate) };
  }

  private static _buildTargets(hotPos: number, constraints: OrderConstraints, seen: boolean[]): number[] {
    const minPos = constraints.getMinValidPosition(hotPos);
    const maxPos = constraints.getMaxValidPosition(hotPos);
    seen.fill(false);
    const targets: number[] = [];
    CostOptimization._addTarget(minPos, hotPos, seen, targets);
    CostOptimization._addTarget(0, hotPos, seen, targets);
    for (const delta of [1, 2, 4, 8, 16, 32]) {
      CostOptimization._addTarget(hotPos - delta, hotPos, seen, targets);
    }
    CostOptimization._addTarget(maxPos, hotPos, seen, targets);
    for (const delta of [1, 2, 4]) {
      CostOptimization._addTarget(hotPos + delta, hotPos, seen, targets);
    }
    return targets;
  }

  private _applyMove(state: State, from: number, to: number, estimator: BddCostEstimator): void {
    BddCompilerSupport.move(state.order, from, to);
    const result = BddCompilerSupport.compile(this._cfg, state.order, this._builder);
    state.bdd = result.bdd;
    state.currentCost = estimator.expectedCost(result.bdd, state.order);
    state.constraints = this._dependencyGraph.createOrderConstraints(state.order);
  }

  private _polish(state: State, estimator: BddCostEstimator): void {
    for (let sweep = 0; sweep < 2; sweep++) {
      let improved = false;
      for (let i = 0; i < state.order.length - 1; i++) {
        if (!state.constraints.canMove(i + 1, i) || !state.constraints.canMove(i, i + 1)) {
          continue;
        }
        const candidate = [...state.order];
        BddCompilerSupport.move(candidate, i + 1, i);
        const result = this._evaluateCandidate(candidate, state, estimator);
        if (result !== undefined && result.cost < state.currentCost) {
          state.order = candidate;
          state.bdd = result.bdd;
          state.currentCost = result.cost;
          state.constraints = this._dependencyGraph.createOrderConstraints(candidate);
          improved = true;
        }
      }
      if (!improved) {
        break;
      }
    }
  }

  private _getHotPositions(bdd: Bdd, order: Condition[], estimator: BddCostEstimator, limit: number): number[] {
    const reachProbs = estimator.reachProbabilities(bdd, order);
    const hotness = order.map((condition, i) => reachProbs[i] * estimator.cost(condition));
    return order
      .map((_, i) => i)
      .sort((a, b) => compareDoubleDescending(hotness[a], hotness[b]))
      .slice(0, limit);
  }

  private static _addTarget(target: number, hotPos: number, seen: boolean[], targets: number[]): void {
    if (target >= 0 && target < seen.length && target !== hotPos && !seen[target]) {
      seen[target] = true;
      targets.push(target);
    }
  }
}

interface State {
  order: Condition[];
  bdd: Bdd;
  constraints: OrderConstraints;
  maxNodes: number;
  currentCost: number;
}

const compareDoubleDescending = (a: number, b: number): number => {
  if (b < a) {
    return -1;
  }
  if (b > a) {
    return 1;
  }
  return 0;
};
