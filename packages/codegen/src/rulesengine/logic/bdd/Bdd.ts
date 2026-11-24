/**
 * A reduced ordered binary decision diagram over endpoint rule conditions, stored as flat node triples.
 */
export class Bdd {
  public static readonly RESULT_OFFSET = 100_000_000;

  private readonly _nodes: Int32Array;
  private readonly _rootRef: number;
  private readonly _conditionCount: number;
  private readonly _resultCount: number;
  private readonly _nodeCount: number;

  public constructor(
    rootRef: number,
    conditionCount: number,
    resultCount: number,
    nodeCount: number,
    nodes: Int32Array | number[]
  ) {
    if (conditionCount < 0) {
      throw new Error("Condition count cannot be negative: " + conditionCount);
    } else if (resultCount < 0) {
      throw new Error("Result count cannot be negative: " + resultCount);
    } else if (nodeCount < 0) {
      throw new Error("Node count cannot be negative: " + nodeCount);
    }
    Bdd._validateRootReference(rootRef, nodeCount);
    if (nodes.length !== nodeCount * 3) {
      throw new Error("Nodes array length must be nodeCount * 3");
    }
    this._rootRef = rootRef;
    this._conditionCount = conditionCount;
    this._resultCount = resultCount;
    this._nodeCount = nodeCount;
    this._nodes = Int32Array.from(nodes);
  }

  public static isNodeReference(ref: number): boolean {
    return (ref > 1 && ref < Bdd.RESULT_OFFSET) || (ref < -1 && ref > -Bdd.RESULT_OFFSET);
  }

  public static isTerminal(ref: number): boolean {
    return ref === 1 || ref === -1;
  }

  public static isComplemented(ref: number): boolean {
    return ref < 0 && ref !== -1;
  }

  public getConditionCount(): number {
    return this._conditionCount;
  }

  public getResultCount(): number {
    return this._resultCount;
  }

  public getNodeCount(): number {
    return this._nodeCount;
  }

  public getRootRef(): number {
    return this._rootRef;
  }

  public getVariable(nodeIndex: number): number {
    this._validateRange(nodeIndex);
    return this._nodes[nodeIndex * 3];
  }

  public getHigh(nodeIndex: number): number {
    this._validateRange(nodeIndex);
    return this._nodes[nodeIndex * 3 + 1];
  }

  public getLow(nodeIndex: number): number {
    this._validateRange(nodeIndex);
    return this._nodes[nodeIndex * 3 + 2];
  }

  public getNodes(consumer: (variable: number, high: number, low: number) => void): void {
    for (let i = 0; i < this._nodeCount; i++) {
      const base = i * 3;
      consumer(this._nodes[base], this._nodes[base + 1], this._nodes[base + 2]);
    }
  }

  private static _validateRootReference(rootRef: number, nodeCount: number): void {
    if (Bdd.isComplemented(rootRef) && !Bdd.isTerminal(rootRef)) {
      throw new Error("Root reference cannot be complemented: " + rootRef);
    } else if (Bdd.isNodeReference(rootRef)) {
      const index = Math.abs(rootRef) - 1;
      if (index >= nodeCount) {
        throw new Error(`Root points to invalid BDD node: ${index} (node count: ${nodeCount})`);
      }
    }
  }

  private _validateRange(index: number): void {
    if (index < 0 || index >= this._nodeCount) {
      throw new Error(`Node index out of bounds: ${index} (size: ${this._nodeCount})`);
    }
  }
}
