import type { Condition } from "../../language";
import type { Cfg } from "../cfg/Cfg";
import { type CfgNode, ConditionNode, ResultNode } from "../cfg/CfgNodes";

interface ConeInfo {
  resultNodes: number;
  inProgress: boolean;
}

const IN_PROGRESS: ConeInfo = { resultNodes: 0, inProgress: true };

/**
 * Measures how deep each condition sits in the CFG and how many results it can reach.
 */
export class CfgConeAnalysis {
  private readonly _dominatorDepth: number[];
  private readonly _reachableResults: number[];
  private readonly _coneCache = new Map<CfgNode, ConeInfo>();

  public constructor(
    cfg: Cfg,
    conditions: Condition[],
    private readonly _conditionToIndex: ReadonlyMap<string, number>
  ) {
    this._dominatorDepth = new Array<number>(conditions.length).fill(Number.MAX_SAFE_INTEGER);
    this._reachableResults = new Array<number>(conditions.length).fill(0);
    this._analyzeCfgNode(cfg.getRoot(), 0);
  }

  public dominatorDepth(conditionIdx: number): number {
    return this._dominatorDepth[conditionIdx];
  }

  public coneSize(conditionIdx: number): number {
    return this._reachableResults[conditionIdx];
  }

  private _analyzeCfgNode(node: CfgNode, depth: number): ConeInfo {
    const cached = this._coneCache.get(node);
    if (cached !== undefined) {
      if (cached.inProgress) {
        throw new Error("Cycle detected in CFG during cone analysis");
      }
      return cached;
    }
    this._coneCache.set(node, IN_PROGRESS);
    let info: ConeInfo;
    if (node instanceof ResultNode) {
      info = { resultNodes: 1, inProgress: false };
    } else if (node instanceof ConditionNode) {
      const condition = node.getCondition().getCondition();
      const conditionIdx = this._conditionToIndex.get(condition.key());
      if (conditionIdx === undefined) {
        throw new Error("Condition not indexed in CFG: " + condition.toString());
      }
      this._dominatorDepth[conditionIdx] = Math.min(this._dominatorDepth[conditionIdx], depth);
      const trueBranchCone = this._analyzeCfgNode(node.getTrueBranch(), depth + 1);
      const falseBranchCone = this._analyzeCfgNode(node.getFalseBranch(), depth + 1);
      if (trueBranchCone.inProgress || falseBranchCone.inProgress) {
        throw new Error("Cycle detected in CFG during cone analysis (branch in-progress)");
      }
      info = { resultNodes: trueBranchCone.resultNodes + falseBranchCone.resultNodes, inProgress: false };
      this._reachableResults[conditionIdx] = Math.max(this._reachableResults[conditionIdx], info.resultNodes);
    } else {
      throw new Error("Unknown node type");
    }
    this._coneCache.set(node, info);
    return info;
  }
}
