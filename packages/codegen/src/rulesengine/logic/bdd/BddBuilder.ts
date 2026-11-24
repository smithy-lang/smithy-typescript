import { Bdd } from "./Bdd";

const TRUE_REF = 1;
const FALSE_REF = -1;
const INITIAL_SIZE = 256 * 3;

/**
 * Hash table keyed by node triples.
 */
class UniqueTable {
  private readonly _table = new Map<string, number>();

  public get(variable: number, high: number, low: number): number | undefined {
    return this._table.get(`${variable},${high},${low}`);
  }

  public put(variable: number, high: number, low: number, nodeIndex: number): void {
    this._table.set(`${variable},${high},${low}`, nodeIndex);
  }

  public clear(): void {
    this._table.clear();
  }
}

/**
 * Builds BDD nodes with complement edges and an ITE operation cache.
 */
export class BddBuilder {
  private _nodes = new Int32Array(INITIAL_SIZE);
  private _nodeCount = 1;
  private readonly _uniqueTable = new UniqueTable();
  private readonly _iteCache = new UniqueTable();
  private _conditionCount = -1;
  private _resultCount = 0;
  private _root = 0;

  public constructor() {
    this._initializeTerminalNode();
  }

  public setRoot(root: number): void {
    this._validateRootRef(root, this._nodeCount);
    this._root = root;
  }

  public setResultCount(resultCount: number): void {
    this._resultCount = resultCount;
  }

  public setConditionCount(count: number): void {
    if (this._conditionCount !== -1) {
      throw new Error("Condition count already set");
    }
    this._conditionCount = count;
  }

  public makeTrue(): number {
    return TRUE_REF;
  }

  public makeFalse(): number {
    return FALSE_REF;
  }

  public makeResult(resultIndex: number): number {
    if (this._conditionCount === -1) {
      throw new Error("Must set condition count before creating results");
    } else if (resultIndex < 0) {
      throw new Error("Result index must be non-negative: " + resultIndex);
    }
    return Bdd.RESULT_OFFSET + resultIndex;
  }

  public makeNode(variable: number, high: number, low: number): number {
    if (this._conditionCount >= 0 && (variable < 0 || variable >= this._conditionCount)) {
      throw new Error("Variable out of bounds: " + variable);
    } else if (high === low) {
      return high;
    }
    const flip = this._shouldFlip(high, low);
    if (flip) {
      high = this.negate(high);
      low = this.negate(low);
    }
    const existing = this._uniqueTable.get(variable, high, low);
    if (existing !== undefined) {
      return this._applyFlip(flip, existing);
    }
    return this._insertNode(variable, high, low, flip);
  }

  public negate(ref: number): number {
    if (ref === 0 || this.isResult(ref)) {
      throw new Error(`Cannot negate ${ref === 0 ? "invalid reference: " : "result terminal: "}${ref}`);
    }
    return -ref;
  }

  public isComplement(ref: number): boolean {
    return ref < 0;
  }

  public isTerminal(ref: number): boolean {
    return Math.abs(ref) === 1;
  }

  public isResult(ref: number): boolean {
    if (this.isTerminal(ref) || this._conditionCount === -1) {
      return false;
    }
    return ref >= Bdd.RESULT_OFFSET;
  }

  public cofactor(bdd: number, varIndex: number, value: boolean): number {
    if (this._isLeaf(bdd)) {
      return bdd;
    }
    const complemented = this.isComplement(bdd);
    const nodeIndex = this._toNodeIndex(bdd);
    this._validateNodeIndex(nodeIndex);
    const base = nodeIndex * 3;
    const nodeVar = this._nodes[base];
    if (nodeVar === varIndex) {
      const child = value ? this._nodes[base + 1] : this._nodes[base + 2];
      return this._applyComplement(complemented, child);
    } else if (nodeVar > varIndex) {
      return bdd;
    }
    const high = this.cofactor(this._nodes[base + 1], varIndex, value);
    const low = this.cofactor(this._nodes[base + 2], varIndex, value);
    const result = this.makeNode(nodeVar, high, low);
    return this._applyComplement(complemented, result);
  }

  public and(f: number, g: number): number {
    this._validateBooleanOperands(f, g, "AND");
    return this.ite(f, g, this.makeFalse());
  }

  public or(f: number, g: number): number {
    this._validateBooleanOperands(f, g, "OR");
    return this.ite(f, this.makeTrue(), g);
  }

  public ite(f: number, g: number, h: number): number {
    if (f < 0) {
      f = -f;
      const tmp = g;
      g = h;
      h = tmp;
    }
    if (f === TRUE_REF || g === h) {
      return g;
    } else if (this.isResult(f)) {
      throw new Error("Condition f must be boolean, not a result terminal");
    } else if (!this.isResult(g) && !this.isResult(h)) {
      if (g === TRUE_REF && h === FALSE_REF) {
        return f;
      } else if (g === FALSE_REF && h === TRUE_REF) {
        return this.negate(f);
      } else if (g === f) {
        return this.or(f, h);
      } else if (h === f) {
        return this.and(f, g);
      } else if (g === this.negate(f)) {
        return this.and(this.negate(f), h);
      } else if (h === this.negate(f)) {
        return this.or(this.negate(f), g);
      } else if (this.isComplement(g) && this.isComplement(h)) {
        return this.negate(this.ite(f, this.negate(g), this.negate(h)));
      }
    }
    const cached = this._iteCache.get(f, g, h);
    if (cached !== undefined) {
      return cached;
    }
    this._iteCache.put(f, g, h, 0);
    const v = this._getTopVariable(f, g, h);
    const r0 = this.ite(this.cofactor(f, v, false), this.cofactor(g, v, false), this.cofactor(h, v, false));
    const r1 = this.ite(this.cofactor(f, v, true), this.cofactor(g, v, true), this.cofactor(h, v, true));
    const result = this.makeNode(v, r1, r0);
    this._iteCache.put(f, g, h, result);
    return result;
  }

  public reduce(rootRef: number): number {
    if (this._isLeaf(rootRef)) {
      return rootRef;
    }
    const rootComplemented = rootRef < 0;
    const absRoot = Math.abs(rootRef);
    const newNodes = new Int32Array(this._nodeCount * 3);
    this._uniqueTable.clear();
    newNodes[0] = -1;
    newNodes[1] = TRUE_REF;
    newNodes[2] = FALSE_REF;
    const oldToNew = new Int32Array(this._nodeCount).fill(-1);
    const newCount = [1];
    const newRoot = this._reduceRec(absRoot, oldToNew, newNodes, newCount);
    this._nodes = newNodes.slice(0, newCount[0] * 3);
    this._nodeCount = newCount[0];
    this.clearCaches();
    return this._applyComplement(rootComplemented, newRoot);
  }

  public clearCaches(): void {
    this._iteCache.clear();
  }

  public reset(): BddBuilder {
    this.clearCaches();
    this._uniqueTable.clear();
    this._nodes.fill(0, 0, this._nodeCount * 3);
    this._nodeCount = 1;
    this._initializeTerminalNode();
    this._conditionCount = -1;
    this._resultCount = 0;
    this._root = 0;
    return this;
  }

  public build(): Bdd {
    if (this._conditionCount === -1) {
      throw new Error("Condition count must be set before building BDD");
    }
    this._validateRootRef(this._root, this._nodeCount);
    return new Bdd(
      this._root,
      this._conditionCount,
      this._resultCount,
      this._nodeCount,
      this._nodes.slice(0, this._nodeCount * 3)
    );
  }

  private _shouldFlip(high: number, low: number): boolean {
    return this.isComplement(low) && !this.isResult(high) && !this.isResult(low);
  }

  private _applyFlip(flip: boolean, index: number): number {
    return flip ? this.negate(this._toReference(index)) : this._toReference(index);
  }

  private _insertNode(variable: number, high: number, low: number, flip: boolean): number {
    this._ensureCapacity();
    const index = this._nodeCount;
    const base = index * 3;
    this._nodes[base] = variable;
    this._nodes[base + 1] = high;
    this._nodes[base + 2] = low;
    this._nodeCount++;
    this._uniqueTable.put(variable, high, low, index);
    return this._applyFlip(flip, index);
  }

  private _ensureCapacity(): void {
    if (this._nodeCount * 3 >= this._nodes.length) {
      const grown = new Int32Array(this._nodes.length * 2);
      grown.set(this._nodes);
      this._nodes = grown;
    }
  }

  private _isLeaf(ref: number): boolean {
    return Math.abs(ref) === TRUE_REF || ref >= Bdd.RESULT_OFFSET;
  }

  private _applyComplement(complemented: boolean, ref: number): number {
    if (!complemented) {
      return ref;
    } else if (this.isResult(ref)) {
      throw new Error("Invariant violated: complemented edge to result terminal: " + ref);
    }
    return this.negate(ref);
  }

  private _reduceRec(ref: number, oldToNew: Int32Array, newNodes: Int32Array, newCount: number[]): number {
    if (this._isLeaf(ref)) {
      return ref;
    }
    const complemented = ref < 0;
    const abs = Math.abs(ref);
    const index = this._toNodeIndex(abs);
    const mapped = oldToNew[index];
    if (mapped !== -1) {
      return this._applyComplement(complemented, mapped);
    }
    const base = index * 3;
    const variable = this._nodes[base];
    let hiNew = this._reduceRec(this._nodes[base + 1], oldToNew, newNodes, newCount);
    let loNew = this._reduceRec(this._nodes[base + 2], oldToNew, newNodes, newCount);
    let resultAbs: number;
    if (hiNew === loNew) {
      resultAbs = hiNew;
    } else {
      const flip = this._shouldFlip(hiNew, loNew);
      if (flip) {
        hiNew = this.negate(hiNew);
        loNew = this.negate(loNew);
      }
      const existing = this._uniqueTable.get(variable, hiNew, loNew);
      if (existing !== undefined) {
        resultAbs = this._toReference(existing);
      } else {
        const nodeIndex = newCount[0]++;
        const newBase = nodeIndex * 3;
        newNodes[newBase] = variable;
        newNodes[newBase + 1] = hiNew;
        newNodes[newBase + 2] = loNew;
        this._uniqueTable.put(variable, hiNew, loNew, nodeIndex);
        resultAbs = this._toReference(nodeIndex);
      }
      if (flip) {
        resultAbs = this.negate(resultAbs);
      }
    }
    oldToNew[index] = resultAbs;
    return this._applyComplement(complemented, resultAbs);
  }

  private _getTopVariable(f: number, g: number, h: number): number {
    let minVar = Number.MAX_SAFE_INTEGER;
    minVar = this._updateMinVariable(minVar, f);
    minVar = this._updateMinVariable(minVar, g);
    minVar = this._updateMinVariable(minVar, h);
    return minVar === Number.MAX_SAFE_INTEGER ? -1 : minVar;
  }

  private _updateMinVariable(currentMin: number, ref: number): number {
    const absRef = Math.abs(ref);
    if (absRef > 1 && absRef < Bdd.RESULT_OFFSET) {
      return Math.min(currentMin, this._nodes[(absRef - 1) * 3]);
    }
    return currentMin;
  }

  private _validateRootRef(ref: number, maxNodeCount: number): void {
    if (ref === 0) {
      throw new Error("Invalid root: 0");
    }
    if (ref <= -Bdd.RESULT_OFFSET) {
      throw new Error("Invalid root: complemented result");
    }
    const abs = Math.abs(ref);
    if (abs === 1 || ref >= Bdd.RESULT_OFFSET) {
      return;
    }
    if (abs < 2 || abs > maxNodeCount) {
      throw new Error("Invalid root: node ref out of range: " + ref);
    }
  }

  private _validateBooleanOperands(f: number, g: number, operation: string): void {
    if (this.isResult(f) || this.isResult(g)) {
      throw new Error(`Cannot perform ${operation} on result terminals`);
    }
  }

  private _toNodeIndex(ref: number): number {
    return Math.abs(ref) - 1;
  }

  private _toReference(nodeIndex: number): number {
    return nodeIndex + 1;
  }

  private _validateNodeIndex(nodeIndex: number): void {
    if (nodeIndex >= this._nodeCount || nodeIndex < 0) {
      throw new Error("Invalid node index: " + nodeIndex);
    }
  }

  private _initializeTerminalNode(): void {
    this._nodes[0] = -1;
    this._nodes[1] = TRUE_REF;
    this._nodes[2] = FALSE_REF;
  }
}
