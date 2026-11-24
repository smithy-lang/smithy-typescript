import { type Condition, IsSet } from "../../language";
import type { Cfg } from "../cfg/Cfg";
import { ConditionDependencyGraph } from "../cfg/ConditionDependencyGraph";
import { CfgConeAnalysis } from "./CfgConeAnalysis";
import type { OrderingStrategy } from "./OrderingStrategy";

const GATE_SUCCESSOR_THRESHOLD = 2;

/**
 * Topological ordering that prefers shallow, wide conditions and isSet gates.
 */
export class InitialOrdering implements OrderingStrategy {
  public constructor(private readonly _cfg: Cfg) {}

  public orderConditions(conditions: Condition[]): Condition[] {
    const deps = new ConditionDependencyGraph(conditions);
    const cones = new CfgConeAnalysis(this._cfg, conditions, deps.getConditionToIndex());
    const order = this._buildCfgOrder(conditions, deps, cones);
    return order.map((id) => conditions[id]);
  }

  private _buildCfgOrder(conditions: Condition[], deps: ConditionDependencyGraph, cones: CfgConeAnalysis): number[] {
    const result: number[] = [];
    const placed = new Array<boolean>(conditions.length).fill(false);
    const ready = new Array<boolean>(conditions.length).fill(false);
    for (let i = 0; i < conditions.length; i++) {
      if (deps.getPredecessorCount(i) === 0) {
        ready[i] = true;
      }
    }
    while (ready.includes(true)) {
      const chosen = this._getNext(ready, cones, conditions, deps);
      result.push(chosen);
      placed[chosen] = true;
      ready[chosen] = false;
      for (const successor of deps.getSuccessors(chosen)) {
        if (!placed[successor] && InitialOrdering._allPredecessorsPlaced(successor, deps, placed)) {
          ready[successor] = true;
        }
      }
    }
    if (result.length !== conditions.length) {
      throw new Error(
        `Topological ordering incomplete (possible cyclic deps). Placed=${result.length} of ${conditions.length}`
      );
    }
    return result;
  }

  private _getNext(
    ready: boolean[],
    cones: CfgConeAnalysis,
    conditions: Condition[],
    deps: ConditionDependencyGraph
  ): number {
    let best = -1;
    let bestDepth = Number.MAX_SAFE_INTEGER;
    let bestCone = -1;
    let bestIsGate = false;
    for (let i = 0; i < ready.length; i++) {
      if (!ready[i]) {
        continue;
      }
      const depth = cones.dominatorDepth(i);
      if (depth > bestDepth) {
        continue;
      }
      const cone = cones.coneSize(i);
      const isGate = InitialOrdering._isIsSet(conditions[i]) && deps.getSuccessorCount(i) > GATE_SUCCESSOR_THRESHOLD;
      if (depth < bestDepth) {
        best = i;
        bestDepth = depth;
        bestCone = cone;
        bestIsGate = isGate;
      } else if (!bestIsGate && isGate) {
        best = i;
        bestCone = cone;
        bestIsGate = true;
      } else if (bestIsGate === isGate && (cone > bestCone || (cone === bestCone && i < best))) {
        best = i;
        bestCone = cone;
      }
    }
    return best;
  }

  private static _allPredecessorsPlaced(id: number, deps: ConditionDependencyGraph, placed: boolean[]): boolean {
    for (const predecessor of deps.getPredecessors(id)) {
      if (!placed[predecessor]) {
        return false;
      }
    }
    return true;
  }

  private static _isIsSet(condition: Condition): boolean {
    return condition.getFunction().getFunctionDefinition() === IsSet.getDefinition();
  }
}
