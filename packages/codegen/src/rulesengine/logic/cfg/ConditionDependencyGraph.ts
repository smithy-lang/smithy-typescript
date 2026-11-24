import { type Condition, IsSet } from "../../language";

/**
 * Tracks which conditions must be evaluated before others because of variable bindings and isSet checks.
 */
export class ConditionDependencyGraph {
  private readonly _conditions: Condition[];
  private readonly _conditionToIndex = new Map<string, number>();
  private readonly _dependencies = new Map<string, Set<string>>();
  private readonly _predecessors: Array<Set<number>> = [];
  private readonly _successors: Array<Set<number>> = [];

  public constructor(conditions: Condition[]) {
    this._conditions = [...conditions];
    const variableDefiners = new Map<string, Set<string>>();
    const isSetConditions = new Map<string, Set<string>>();
    const n = conditions.length;
    for (let i = 0; i < n; i++) {
      this._conditionToIndex.set(conditions[i].key(), i);
      this._predecessors.push(new Set());
      this._successors.push(new Set());
    }
    for (const condition of conditions) {
      const result = condition.getResult();
      if (result !== undefined) {
        getOrCreate(variableDefiners, result).add(condition.key());
      }
      if (isIsSet(condition)) {
        for (const variable of condition.getFunction().getReferences()) {
          getOrCreate(isSetConditions, variable).add(condition.key());
        }
      }
    }
    const producers = new Map<string, Set<number>>();
    const isSetters = new Map<string, Set<number>>();
    for (let i = 0; i < n; i++) {
      const condition = conditions[i];
      const result = condition.getResult();
      if (result !== undefined) {
        getOrCreate(producers, result).add(i);
      }
      if (isIsSet(condition)) {
        for (const reference of condition.getFunction().getReferences()) {
          getOrCreate(isSetters, reference).add(i);
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const condition = conditions[i];
      const conditionDependencies = new Set<string>();
      for (const usedVar of condition.getFunction().getReferences()) {
        for (const definer of variableDefiners.get(usedVar) ?? []) {
          conditionDependencies.add(definer);
        }
        if (!isIsSet(condition)) {
          for (const setter of isSetConditions.get(usedVar) ?? []) {
            conditionDependencies.add(setter);
          }
        }
        for (const producer of producers.get(usedVar) ?? []) {
          if (producer !== i) {
            this._predecessors[i].add(producer);
            this._successors[producer].add(i);
          }
        }
        if (!isIsSet(condition)) {
          for (const setter of isSetters.get(usedVar) ?? []) {
            if (setter !== i) {
              this._predecessors[i].add(setter);
              this._successors[setter].add(i);
            }
          }
        }
      }
      conditionDependencies.delete(condition.key());
      if (conditionDependencies.size > 0) {
        this._dependencies.set(condition.key(), conditionDependencies);
      }
    }
  }

  public getDependencies(condition: Condition): ReadonlySet<string> {
    return this._dependencies.get(condition.key()) ?? EMPTY_SET;
  }

  public getPredecessors(index: number): ReadonlySet<number> {
    return this._predecessors[index];
  }

  public getSuccessors(index: number): ReadonlySet<number> {
    return this._successors[index];
  }

  public getPredecessorCount(index: number): number {
    return this._predecessors[index].size;
  }

  public getSuccessorCount(index: number): number {
    return this._successors[index].size;
  }

  public getConditionToIndex(): ReadonlyMap<string, number> {
    return this._conditionToIndex;
  }

  public createOrderConstraints(ordering: Condition[]): OrderConstraints {
    return new OrderConstraints(this._conditions, this._conditionToIndex, this._predecessors, ordering);
  }
}

/**
 * Valid position ranges for each condition in an ordering.
 */
export class OrderConstraints {
  private readonly _minValidPosition: number[];
  private readonly _maxValidPosition: number[];

  public constructor(
    conditions: Condition[],
    conditionToIndex: ReadonlyMap<string, number>,
    predecessors: Array<Set<number>>,
    ordering: Condition[]
  ) {
    const n = ordering.length;
    if (n !== conditions.length) {
      throw new Error(`Ordering size (${n}) doesn't match dependency graph size (${conditions.length})`);
    }
    const orderIndex = new Map<string, number>();
    this._minValidPosition = new Array<number>(n).fill(0);
    this._maxValidPosition = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      orderIndex.set(ordering[i].key(), i);
    }
    for (let i = 0; i < n; i++) {
      this._maxValidPosition[i] = n - 1;
      const originalIndex = conditionToIndex.get(ordering[i].key());
      if (originalIndex === undefined) {
        throw new Error("Condition not in dependency graph: " + ordering[i].toString());
      }
      for (const dependencyIndex of predecessors[originalIndex]) {
        const dependencyOrderIndex = orderIndex.get(conditions[dependencyIndex].key());
        if (dependencyOrderIndex !== undefined) {
          this._minValidPosition[i] = Math.max(this._minValidPosition[i], dependencyOrderIndex + 1);
          this._maxValidPosition[dependencyOrderIndex] = Math.min(this._maxValidPosition[dependencyOrderIndex], i - 1);
        }
      }
    }
  }

  public canMove(from: number, to: number): boolean {
    return from === to || (to >= this._minValidPosition[from] && to <= this._maxValidPosition[from]);
  }

  public getMinValidPosition(positionIndex: number): number {
    return this._minValidPosition[positionIndex];
  }

  public getMaxValidPosition(positionIndex: number): number {
    return this._maxValidPosition[positionIndex];
  }
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const isIsSet = (condition: Condition): boolean =>
  condition.getFunction().getFunctionDefinition() === IsSet.getDefinition();

const getOrCreate = <V>(map: Map<string, Set<V>>, key: string): Set<V> => {
  let value = map.get(key);
  if (value === undefined) {
    value = new Set();
    map.set(key, value);
  }
  return value;
};
