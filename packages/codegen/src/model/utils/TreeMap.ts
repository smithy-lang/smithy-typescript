export type Comparator<T> = (left: T, right: T) => number;

/**
 * Objects with a natural order, like java.lang.Comparable.
 */
interface Comparable<T> {
  compareTo(other: T): number;
}

/**
 * Natural ordering like Java: strings by UTF-16 code unit, numbers numerically, otherwise by compareTo.
 */
const naturalOrder = <T>(left: T, right: T): number => {
  if (typeof left === "string" && typeof right === "string") {
    return compareCodeUnits(left, right);
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "object" && left !== null && typeof (left as unknown as Comparable<T>).compareTo === "function") {
    return (left as unknown as Comparable<T>).compareTo(right);
  }
  throw new Error("Keys are not comparable. Provide a comparator.");
};

/**
 * Compares strings by UTF-16 code units, like java.lang.String#compareTo.
 *
 * @internal
 */
export const compareCodeUnits = (left: string, right: string): number => {
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const difference = left.charCodeAt(i) - right.charCodeAt(i);
    if (difference !== 0) {
      return difference;
    }
  }
  return left.length - right.length;
};

/**
 * A Map that iterates in key order, like java.util.TreeMap. Keys are equal when the comparator returns zero.
 * Inserts append to an unsorted tail, and the sort happens when an iterator or first/last key is requested.
 *
 * @internal
 */
export class TreeMap<K, V> implements Map<K, V> {
  private readonly _comparator: Comparator<K>;
  private _keys: K[] = [];
  private _values: V[] = [];
  private _sortedCount = 0;

  public constructor(comparator?: Comparator<K> | null, entries?: Iterable<readonly [K, V]> | null) {
    this._comparator = comparator ?? naturalOrder;
    if (entries !== undefined && entries !== null) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }

  public get size(): number {
    return this._keys.length;
  }

  public get [Symbol.toStringTag](): string {
    return "TreeMap";
  }

  public get(key: K): V | undefined {
    const index = this._indexOf(key);
    return index >= 0 ? this._values[index] : undefined;
  }

  public has(key: K): boolean {
    return this._indexOf(key) >= 0;
  }

  public set(key: K, value: V): this {
    const index = this._indexOf(key);
    if (index >= 0) {
      this._values[index] = value;
    } else {
      this._keys.push(key);
      this._values.push(value);
    }
    return this;
  }

  public delete(key: K): boolean {
    const index = this._indexOf(key);
    if (index < 0) {
      return false;
    }
    this._keys.splice(index, 1);
    this._values.splice(index, 1);
    if (index < this._sortedCount) {
      this._sortedCount--;
    }
    return true;
  }

  public clear(): void {
    this._keys = [];
    this._values = [];
    this._sortedCount = 0;
  }

  public firstKey(): K | undefined {
    this._sort();
    return this._keys[0];
  }

  public lastKey(): K | undefined {
    this._sort();
    return this._keys[this._keys.length - 1];
  }

  public forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void {
    this._sort();
    for (let i = 0; i < this._keys.length; i++) {
      callbackfn.call(thisArg, this._values[i], this._keys[i], this);
    }
  }

  public *keys(): MapIterator<K> {
    this._sort();
    for (const key of this._keys) {
      yield key;
    }
  }

  public *values(): MapIterator<V> {
    this._sort();
    for (const value of this._values) {
      yield value;
    }
  }

  public *entries(): MapIterator<[K, V]> {
    this._sort();
    for (let i = 0; i < this._keys.length; i++) {
      yield [this._keys[i], this._values[i]];
    }
  }

  public [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }

  /**
   * Returns the index of the key in the storage arrays, or -1 when absent.
   */
  private _indexOf(key: K): number {
    let low = 0;
    let high = this._sortedCount - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const order = this._comparator(this._keys[mid], key);
      if (order < 0) {
        low = mid + 1;
      } else if (order > 0) {
        high = mid - 1;
      } else {
        return mid;
      }
    }
    for (let i = this._sortedCount; i < this._keys.length; i++) {
      if (this._comparator(this._keys[i], key) === 0) {
        return i;
      }
    }
    return -1;
  }

  private _sort(): void {
    if (this._sortedCount === this._keys.length) {
      return;
    }
    const order = this._keys.map((_, index) => index).sort((a, b) => this._comparator(this._keys[a], this._keys[b]));
    this._keys = order.map((index) => this._keys[index]);
    this._values = order.map((index) => this._values[index]);
    this._sortedCount = this._keys.length;
  }
}
