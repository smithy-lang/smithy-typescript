import { type Condition, LibraryFunction } from "../language";

/**
 * Estimates the evaluation cost of a condition.
 */
export interface ConditionCostModel {
  cost(condition: Condition): number;
}

export class DefaultConditionCostModel implements ConditionCostModel {
  public constructor(private readonly _nestedMultiplier = 2) {}

  public cost(condition: Condition): number {
    return this._computeCost(condition.getFunction());
  }

  private _computeCost(fn: LibraryFunction): number {
    const base = fn.getFunctionDefinition().getCost();
    let argCost = 0;
    for (const arg of fn.getArguments()) {
      if (arg instanceof LibraryFunction) {
        argCost += this._computeCost(arg) * this._nestedMultiplier;
      }
    }
    return base + argCost;
  }
}
