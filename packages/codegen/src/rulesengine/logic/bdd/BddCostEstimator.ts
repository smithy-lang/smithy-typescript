import type { Condition } from "../../language";
import type { ConditionCostModel } from "../ConditionCostModel";
import { Bdd } from "./Bdd";

/**
 * Computes the expected evaluation cost of a BDD for a given condition ordering.
 */
export class BddCostEstimator {
  private readonly _costs = new Map<Condition, number>();

  public constructor(
    conditions: Condition[],
    costModel: ConditionCostModel,
    private readonly _trueProbability?: (condition: Condition) => number
  ) {
    for (const condition of conditions) {
      this._costs.set(condition, costModel.cost(condition));
    }
  }

  public expectedCost(bdd: Bdd, ordering: Condition[]): number {
    const rootRef = bdd.getRootRef();
    if (!Bdd.isNodeReference(rootRef)) {
      return 0;
    }
    const size = ordering.length;
    const costArray = new Array<number>(size);
    const probArray = new Array<number>(size);
    for (let i = 0; i < size; i++) {
      const condition = ordering[i];
      costArray[i] = this._costs.get(condition) ?? 1;
      probArray[i] = this._trueProbability !== undefined ? this._trueProbability(condition) : 0.5;
    }
    const expectedEvaluations = BddCostEstimator._computeExpectedEvaluations(bdd, probArray);
    let totalCost = 0;
    for (let v = 0; v < expectedEvaluations.length && v < costArray.length; v++) {
      totalCost += expectedEvaluations[v] * costArray[v];
    }
    return totalCost;
  }

  public reachProbabilities(bdd: Bdd, ordering: Condition[]): number[] {
    const rootRef = bdd.getRootRef();
    if (!Bdd.isNodeReference(rootRef)) {
      return new Array<number>(bdd.getConditionCount()).fill(0);
    }
    const probArray = ordering.map((condition) =>
      this._trueProbability !== undefined ? this._trueProbability(condition) : 0.5
    );
    return BddCostEstimator._computeExpectedEvaluations(bdd, probArray);
  }

  public cost(condition: Condition): number {
    return this._costs.get(condition) ?? 1;
  }

  private static _computeExpectedEvaluations(bdd: Bdd, trueProbabilities: number[]): number[] {
    const nodeCount = bdd.getNodeCount();
    const conditionCount = bdd.getConditionCount();
    const expectedEvaluations = new Array<number>(conditionCount).fill(0);
    const rootIdx = Math.abs(bdd.getRootRef()) - 1;
    if (rootIdx < 0 || rootIdx >= nodeCount) {
      return expectedEvaluations;
    }
    const nodeReachProb = new Array<number>(nodeCount).fill(0);
    nodeReachProb[rootIdx] = 1;
    for (let i = nodeCount - 1; i >= 0; i--) {
      const prob = nodeReachProb[i];
      if (prob < 1e-9) {
        continue;
      }
      const varIdx = bdd.getVariable(i);
      if (varIdx >= 0 && varIdx < conditionCount) {
        expectedEvaluations[varIdx] += prob;
      }
      const pTrue = varIdx >= 0 && varIdx < trueProbabilities.length ? trueProbabilities[varIdx] : 0.5;
      const highRef = bdd.getHigh(i);
      if (Bdd.isNodeReference(highRef)) {
        nodeReachProb[Math.abs(highRef) - 1] += prob * pTrue;
      }
      const lowRef = bdd.getLow(i);
      if (Bdd.isNodeReference(lowRef)) {
        nodeReachProb[Math.abs(lowRef) - 1] += prob * (1 - pTrue);
      }
    }
    return expectedEvaluations;
  }
}
