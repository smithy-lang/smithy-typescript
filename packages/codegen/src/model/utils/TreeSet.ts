import { type Comparator, TreeMap } from "./TreeMap";

/**
 * A Set that iterates in element order, like java.util.TreeSet, built on TreeMap.
 *
 * @internal
 */
export class TreeSet<T> implements Set<T> {
  private readonly _map: TreeMap<T, true>;

  public constructor(values?: Iterable<T> | null, comparator?: Comparator<T> | null) {
    this._map = new TreeMap<T, true>(comparator);
    if (values !== undefined && values !== null) {
      for (const value of values) {
        this.add(value);
      }
    }
  }

  public get size(): number {
    return this._map.size;
  }

  public get [Symbol.toStringTag](): string {
    return "TreeSet";
  }

  public add(value: T): this {
    this._map.set(value, true);
    return this;
  }

  public has(value: T): boolean {
    return this._map.has(value);
  }

  public delete(value: T): boolean {
    return this._map.delete(value);
  }

  public clear(): void {
    this._map.clear();
  }

  public first(): T | undefined {
    return this._map.firstKey();
  }

  public last(): T | undefined {
    return this._map.lastKey();
  }

  public forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: unknown): void {
    for (const value of this._map.keys()) {
      callbackfn.call(thisArg, value, value, this);
    }
  }

  public values(): SetIterator<T> {
    return this._map.keys() as unknown as SetIterator<T>;
  }

  public keys(): SetIterator<T> {
    return this.values();
  }

  public *entries(): SetIterator<[T, T]> {
    for (const value of this._map.keys()) {
      yield [value, value];
    }
  }

  public [Symbol.iterator](): SetIterator<T> {
    return this.values();
  }
}
