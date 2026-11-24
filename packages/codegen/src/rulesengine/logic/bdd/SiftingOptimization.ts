import type { Condition, Rule } from "../../language";
import type { EndpointBddTrait } from "../../traits/EndpointBddTrait";
import type { Cfg } from "../cfg/Cfg";
import { ConditionDependencyGraph, type OrderConstraints } from "../cfg/ConditionDependencyGraph";
import { DefaultConditionCostModel } from "../ConditionCostModel";
import type { Bdd } from "./Bdd";
import { BddBuilder } from "./BddBuilder";
import { BddCompilerSupport } from "./BddCompilerSupport";
import { BddCostEstimator } from "./BddCostEstimator";

const PLATEAU_HISTORY_SIZE = 3;
const PLATEAU_THRESHOLD = 0.5;

interface OptimizationEffort {
  sampleRate: number;
  maxPositions: number;
  nearbyRadius: number;
  exhaustiveThreshold: number;
  defaultNodeThreshold: number;
  defaultMaxPasses: number;
}

const COARSE: OptimizationEffort = {
  sampleRate: 11,
  maxPositions: 4,
  nearbyRadius: 0,
  exhaustiveThreshold: 20,
  defaultNodeThreshold: 4_000,
  defaultMaxPasses: 6,
};
const MEDIUM: OptimizationEffort = {
  sampleRate: 2,
  maxPositions: 24,
  nearbyRadius: 6,
  exhaustiveThreshold: 20,
  defaultNodeThreshold: 1_000,
  defaultMaxPasses: 6,
};
const GRANULAR: OptimizationEffort = {
  sampleRate: 1,
  maxPositions: 50,
  nearbyRadius: 12,
  exhaustiveThreshold: 20,
  defaultNodeThreshold: 8_000,
  defaultMaxPasses: 12,
};

interface SiftingOptimizationOptions {
  cfg: Cfg;
  coarseMinNodes?: number;
  coarseMaxPasses?: number;
  mediumMinNodes?: number;
  mediumMaxPasses?: number;
  granularMaxNodes?: number;
  granularMaxPasses?: number;
}

/**
 * Reorders BDD variables by sifting passes to shrink the diagram.
 */
export class SiftingOptimization {
  private readonly _builder = new BddBuilder();
  private readonly _cfg: Cfg;
  private readonly _dependencyGraph: ConditionDependencyGraph;
  private readonly _costModel = new DefaultConditionCostModel();
  private _costEstimator: BddCostEstimator | undefined;
  private readonly _coarseMinNodes: number;
  private readonly _coarseMaxPasses: number;
  private readonly _mediumMinNodes: number;
  private readonly _mediumMaxPasses: number;
  private readonly _granularMaxNodes: number;
  private readonly _granularMaxPasses: number;

  public constructor(options: SiftingOptimizationOptions) {
    this._cfg = options.cfg;
    this._coarseMinNodes = options.coarseMinNodes ?? COARSE.defaultNodeThreshold;
    this._coarseMaxPasses = options.coarseMaxPasses ?? COARSE.defaultMaxPasses;
    this._mediumMinNodes = options.mediumMinNodes ?? MEDIUM.defaultNodeThreshold;
    this._mediumMaxPasses = options.mediumMaxPasses ?? MEDIUM.defaultMaxPasses;
    this._granularMaxNodes = options.granularMaxNodes ?? GRANULAR.defaultNodeThreshold;
    this._granularMaxPasses = options.granularMaxPasses ?? GRANULAR.defaultMaxPasses;
    this._dependencyGraph = new ConditionDependencyGraph(this._cfg.getConditions());
  }

  public apply(trait: EndpointBddTrait): EndpointBddTrait {
    const order = [...trait.getConditions()];
    const bdd = trait.getBdd();
    const initialSize = bdd.getNodeCount() - 1;
    const state: State = { order, initialSize, bestBdd: bdd, currentSize: initialSize, results: trait.getResults() };
    this._costEstimator = new BddCostEstimator(state.order, this._costModel);
    this._runOptimizationStage(state, new AdaptiveEffort(COARSE), this._coarseMinNodes, this._coarseMaxPasses, 4.0);
    this._runOptimizationStage(state, new AdaptiveEffort(MEDIUM), this._mediumMinNodes, this._mediumMaxPasses, 1.5);
    if (state.currentSize <= this._granularMaxNodes) {
      this._runOptimizationStage(state, new AdaptiveEffort(GRANULAR), 0, this._granularMaxPasses, 0.0);
    }
    this._runBlockMoves(state);
    this._runAdjacentSwaps(state);
    if (state.currentSize >= state.initialSize) {
      return trait;
    }
    return trait.withOrdering(state.order, state.results, state.bestBdd);
  }

  private _runOptimizationStage(
    state: State,
    adaptiveEffort: AdaptiveEffort,
    targetNodes: number,
    maxPasses: number,
    minReduction: number
  ): void {
    if (targetNodes > 0 && state.currentSize <= targetNodes) {
      return;
    }
    const history = new Array<number>(PLATEAU_HISTORY_SIZE).fill(0);
    let historyIdx = 0;
    let consecutiveLow = 0;
    for (let pass = 1; pass <= maxPasses + adaptiveEffort.bonusPasses; pass++) {
      if (targetNodes > 0 && state.currentSize <= targetNodes) {
        break;
      }
      const startSize = state.currentSize;
      const result = this._runPass(state, adaptiveEffort);
      if (result.improvements === 0) {
        break;
      }
      state.bestBdd = result.bestBdd!;
      state.currentSize = result.bestSize;
      state.results = result.bestResults!;
      const reduction = (1.0 - result.bestSize / startSize) * 100;
      history[historyIdx++ % PLATEAU_HISTORY_SIZE] = reduction;
      if (historyIdx >= PLATEAU_HISTORY_SIZE) {
        let plateau = true;
        for (const r of history) {
          if (r >= PLATEAU_THRESHOLD) {
            plateau = false;
            break;
          }
        }
        if (plateau) {
          break;
        }
      }
      consecutiveLow = adaptiveEffort.adapt(reduction) ? 0 : reduction < 2.0 ? consecutiveLow + 1 : 0;
      if (consecutiveLow >= 2 || (minReduction > 0 && reduction < minReduction)) {
        break;
      }
    }
  }

  private _runBlockMoves(state: State): void {
    if (state.currentSize > this._granularMaxNodes) {
      return;
    }
    const blocks = this._findDependencyBlocks(state.order).filter((block) => block.length >= 2 && block.length <= 5);
    for (const block of blocks) {
      const context = this._createPassContext(state);
      const result = this._tryBlockMove(block, context);
      if (result !== undefined && result.size < context.bestSize) {
        state.bestBdd = result.bdd;
        state.currentSize = result.size;
        state.results = result.results;
      }
    }
  }

  private _findDependencyBlocks(ordering: Condition[]): number[][] {
    const blocks: number[][] = [];
    if (ordering.length === 0) {
      return blocks;
    }
    let current = [0];
    for (let i = 1; i < ordering.length; i++) {
      if (this._dependencyGraph.getDependencies(ordering[i]).has(ordering[i - 1].key())) {
        current.push(i);
      } else {
        if (current.length >= 2) {
          blocks.push(current);
        }
        current = [i];
      }
    }
    if (current.length >= 2) {
      blocks.push(current);
    }
    return blocks;
  }

  private _tryBlockMove(block: number[], context: PassContext): Result | undefined {
    const blockStart = block[0];
    const blockEnd = block[block.length - 1];
    const blockSize = block.length;
    let minPos = 0;
    let maxPos = context.order.length - blockSize;
    for (const index of block) {
      const offset = index - blockStart;
      minPos = Math.max(minPos, context.constraints.getMinValidPosition(index) - offset);
      maxPos = Math.min(maxPos, context.constraints.getMaxValidPosition(index) - offset);
    }
    if (minPos >= maxPos) {
      return undefined;
    }
    const targets = [minPos, maxPos, minPos + Math.trunc((maxPos - minPos) / 2)];
    let best: Result | undefined;
    for (const target of targets) {
      if (target === blockStart) {
        continue;
      }
      const candidate = [...context.order];
      SiftingOptimization._moveBlock(candidate, blockStart, blockEnd, target);
      const newConstraints = this._dependencyGraph.createOrderConstraints(candidate);
      let valid = true;
      for (let j = 0; j < candidate.length; j++) {
        if (newConstraints.getMinValidPosition(j) > j || newConstraints.getMaxValidPosition(j) < j) {
          valid = false;
          break;
        }
      }
      if (!valid) {
        continue;
      }
      const compiled = BddCompilerSupport.compile(this._cfg, candidate, this._builder);
      const size = compiled.bdd.getNodeCount() - 1;
      const cost = this._computeCost(compiled.bdd, candidate);
      if (best === undefined || size < best.size || (size === best.size && cost < best.cost)) {
        best = { position: target, size, cost, bdd: compiled.bdd, results: compiled.results };
      }
    }
    return best;
  }

  private static _moveBlock(order: Condition[], start: number, end: number, targetStart: number): void {
    if (targetStart === start) {
      return;
    }
    const blockSize = end - start + 1;
    const block = order.slice(start, start + blockSize);
    if (targetStart < start) {
      order.copyWithin(targetStart + blockSize, targetStart, start);
      for (let i = 0; i < blockSize; i++) {
        order[targetStart + i] = block[i];
      }
    } else {
      const shiftStart = end + 1;
      let shiftEnd = targetStart + blockSize;
      if (shiftEnd > order.length) {
        shiftEnd = order.length;
      }
      order.copyWithin(start, shiftStart, shiftEnd);
      for (let i = 0; i < blockSize; i++) {
        order[targetStart + i] = block[i];
      }
    }
  }

  private _runAdjacentSwaps(state: State): void {
    if (state.currentSize > this._granularMaxNodes) {
      return;
    }
    for (let sweep = 0; sweep < 3; sweep++) {
      const context = this._createPassContext(state);
      for (let i = 0; i < state.order.length - 1; i++) {
        if (context.constraints.canMove(i, i + 1) && context.constraints.canMove(i + 1, i)) {
          BddCompilerSupport.move(state.order, i, i + 1);
          const compiled = BddCompilerSupport.compile(this._cfg, state.order, this._builder);
          const size = compiled.bdd.getNodeCount() - 1;
          if (size < context.bestSize) {
            this._recordImprovement(context, {
              position: i + 1,
              size,
              cost: Number.MAX_VALUE,
              bdd: compiled.bdd,
              results: compiled.results,
            });
          } else {
            BddCompilerSupport.move(state.order, i + 1, i);
          }
        }
      }
      if (context.improvements === 0) {
        break;
      }
      state.bestBdd = context.bestBdd!;
      state.currentSize = context.bestSize;
      state.results = context.bestResults!;
    }
  }

  private _runPass(state: State, effort: AdaptiveEffort): PassContext {
    const context = this._createPassContext(state);
    const nodeCounts = SiftingOptimization._computeNodeCountsPerVariable(state.bestBdd);
    const selectedIndices = SiftingOptimization._selectConditionsByPriority(
      state.order.length,
      nodeCounts,
      effort.sampleRate
    );
    for (const varIdx of selectedIndices) {
      const positions = SiftingOptimization._getStrategicPositions(
        varIdx,
        context.constraints,
        effort,
        state.order.length
      );
      if (positions.length === 0) {
        continue;
      }
      const best = this._findBestPosition(positions, context, varIdx);
      if (best !== undefined && best.size <= context.bestSize) {
        BddCompilerSupport.move(context.order, varIdx, best.position);
        this._recordImprovement(context, best);
      }
    }
    return context;
  }

  private _createPassContext(state: State): PassContext {
    return {
      order: state.order,
      bestBdd: undefined,
      bestSize: state.currentSize,
      bestResults: undefined,
      improvements: 0,
      constraints: this._dependencyGraph.createOrderConstraints(state.order),
    };
  }

  private _recordImprovement(context: PassContext, result: Result): void {
    context.bestBdd = result.bdd;
    context.bestSize = result.size;
    context.bestResults = result.results;
    context.constraints = this._dependencyGraph.createOrderConstraints(context.order);
    context.improvements++;
  }

  private static _computeNodeCountsPerVariable(bdd: Bdd): number[] {
    const counts = new Array<number>(bdd.getConditionCount()).fill(0);
    for (let i = 0; i < bdd.getNodeCount(); i++) {
      const v = bdd.getVariable(i);
      if (v >= 0 && v < counts.length) {
        counts[v]++;
      }
    }
    return counts;
  }

  private static _selectConditionsByPriority(n: number, nodeCounts: number[], sampleRate: number): number[] {
    const indices = Array.from({ length: n }, (_, i) => i).sort((a, b) => nodeCounts[b] - nodeCounts[a]);
    return sampleRate <= 1 ? indices : indices.slice(0, Math.max(1, Math.trunc(n / sampleRate)));
  }

  private _findBestPosition(positions: number[], context: PassContext, varIdx: number): Result | undefined {
    const candidates: Array<Result & { orderList: Condition[] }> = [];
    for (const position of positions) {
      const order = [...context.order];
      BddCompilerSupport.move(order, varIdx, position);
      const compiled = BddCompilerSupport.compile(this._cfg, order, this._builder);
      const size = compiled.bdd.getNodeCount() - 1;
      if (size <= context.bestSize) {
        candidates.push({
          position,
          size,
          cost: Number.MAX_VALUE,
          bdd: compiled.bdd,
          results: compiled.results,
          orderList: order,
        });
      }
    }
    if (candidates.length === 0) {
      return undefined;
    }
    let minSize = Number.MAX_SAFE_INTEGER;
    for (const candidate of candidates) {
      if (candidate.size < minSize) {
        minSize = candidate.size;
      }
    }
    let best: Result | undefined;
    for (const candidate of candidates) {
      if (candidate.size === minSize) {
        const cost = this._computeCost(candidate.bdd, candidate.orderList);
        if (best === undefined || cost < best.cost || (cost === best.cost && candidate.position < best.position)) {
          best = {
            position: candidate.position,
            size: candidate.size,
            cost,
            bdd: candidate.bdd,
            results: candidate.results,
          };
        }
      }
    }
    return best;
  }

  private _computeCost(bdd: Bdd, ordering: Condition[]): number {
    return this._costEstimator!.expectedCost(bdd, ordering);
  }

  private static _getStrategicPositions(
    varIdx: number,
    constraints: OrderConstraints,
    effort: AdaptiveEffort,
    orderSize: number
  ): number[] {
    const min = constraints.getMinValidPosition(varIdx);
    const max = constraints.getMaxValidPosition(varIdx);
    const range = max - min;
    if (range <= effort.base.exhaustiveThreshold) {
      const positions: number[] = [];
      for (let p = min; p < max; p++) {
        if (p !== varIdx && constraints.canMove(varIdx, p)) {
          positions.push(p);
        }
      }
      return positions;
    }
    const positions: number[] = [];
    const seen = new Array<boolean>(orderSize).fill(false);
    if (min !== varIdx && constraints.canMove(varIdx, min)) {
      positions.push(min);
      seen[min] = true;
    }
    if (max - 1 !== varIdx && constraints.canMove(varIdx, max - 1)) {
      positions.push(max - 1);
      seen[max - 1] = true;
    }
    const step = Math.max(1, Math.trunc(range / Math.min(15, Math.trunc(effort.maxPositions / 2))));
    for (let p = min + step; p < max - step && positions.length < effort.maxPositions; p += step) {
      if (p !== varIdx && !seen[p] && constraints.canMove(varIdx, p)) {
        positions.push(p);
        seen[p] = true;
      }
    }
    for (let off = -effort.nearbyRadius; off <= effort.nearbyRadius && positions.length < effort.maxPositions; off++) {
      const p = varIdx + off;
      if (off !== 0 && p >= min && p < max && !seen[p] && constraints.canMove(varIdx, p)) {
        positions.push(p);
        seen[p] = true;
      }
    }
    return positions;
  }
}

class AdaptiveEffort {
  private static readonly _HIGH_THRESHOLD = 10.0;
  private static readonly _LOW_THRESHOLD = 2.0;

  public sampleRate: number;
  public maxPositions: number;
  public nearbyRadius: number;
  public bonusPasses = 0;

  public constructor(public readonly base: OptimizationEffort) {
    this.sampleRate = base.sampleRate;
    this.maxPositions = base.maxPositions;
    this.nearbyRadius = base.nearbyRadius;
  }

  public adapt(reductionPercent: number): boolean {
    if (reductionPercent >= AdaptiveEffort._HIGH_THRESHOLD) {
      this.sampleRate = Math.max(1, this.sampleRate - 1);
      this.maxPositions = Math.min(this.base.maxPositions * 2, this.maxPositions + 5);
      this.nearbyRadius = Math.min(this.base.nearbyRadius + 6, this.nearbyRadius + 2);
      this.bonusPasses = Math.min(this.bonusPasses + 2, 6);
      return true;
    } else if (reductionPercent < AdaptiveEffort._LOW_THRESHOLD) {
      this.sampleRate = Math.min(this.base.sampleRate * 2, this.sampleRate + 2);
      this.maxPositions = Math.max(Math.trunc(this.base.maxPositions / 2), this.maxPositions - 3);
      this.nearbyRadius = Math.max(0, this.nearbyRadius - 2);
      this.bonusPasses = Math.max(0, this.bonusPasses - 2);
    }
    return false;
  }
}

interface PassContext {
  order: Condition[];
  constraints: OrderConstraints;
  bestBdd: Bdd | undefined;
  bestSize: number;
  bestResults: Rule[] | undefined;
  improvements: number;
}

interface Result {
  position: number;
  size: number;
  cost: number;
  bdd: Bdd;
  results: Rule[];
}

interface State {
  order: Condition[];
  initialSize: number;
  bestBdd: Bdd;
  currentSize: number;
  results: Rule[];
}
