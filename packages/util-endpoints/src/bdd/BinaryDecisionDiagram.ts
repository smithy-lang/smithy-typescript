import type { EndpointObjectHeaders, ParameterObject } from "@smithy/types";

import type { FunctionArgv } from "../types/shared";

/**
 * @internal
 */
type BddCondition = [string, FunctionArgv] | [string, FunctionArgv, string];

/**
 * @internal
 */
type BddResult = [-1] | [-1, string] | [string, Record<string, ParameterObject>, EndpointObjectHeaders];

/**
 * @internal
 */
export class BinaryDecisionDiagram {
  public nodes: Int32Array;
  public root: number;
  public conditions: BddCondition[];
  public results: BddResult[];

  private constructor(bdd: Int32Array, root: number, conditions: BddCondition[] | any[], results: BddResult[] | any[]) {
    this.nodes = bdd;
    this.root = root;
    this.conditions = conditions;
    this.results = results;
  }

  public static from(bdd: Int32Array, root: number, conditions: BddCondition[] | any[], results: BddResult[] | any[]) {
    return new BinaryDecisionDiagram(bdd, root, conditions, results);
  }
}
