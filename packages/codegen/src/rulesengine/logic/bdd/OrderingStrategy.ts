import type { Condition } from "../../language";

/**
 * Chooses the order in which conditions become BDD variables.
 */
export interface OrderingStrategy {
  orderConditions(conditions: Condition[]): Condition[];
}

/**
 * An ordering strategy that returns the same conditions it was given at construction.
 */
export class FixedOrdering implements OrderingStrategy {
  public constructor(private readonly _ordering: Condition[]) {}

  public orderConditions(): Condition[] {
    return this._ordering;
  }
}
