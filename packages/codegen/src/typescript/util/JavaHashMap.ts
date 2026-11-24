/** Java String.hashCode for the UTF-16 code units of a string. */
const javaStringHashCode = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  }
  return h;
};

const spread = (h: number): number => h ^ (h >>> 16);

const tableSizeFor = (capacity: number): number => {
  let n = 1;
  while (n < capacity) {
    n <<= 1;
  }
  return n;
};

interface Node<V> {
  hash: number;
  key: string;
  value: V;
}

/**
 * String-keyed map that iterates in the same order as java.util.HashMap.
 */
export class JavaHashMap<V> {
  private _table: Node<V>[][] | undefined;
  private _threshold: number;
  private _size = 0;

  public constructor(initialCapacity = 16) {
    this._threshold = tableSizeFor(initialCapacity);
  }

  public get size(): number {
    return this._size;
  }

  public set(key: string, value: V): this {
    const hash = spread(javaStringHashCode(key));
    const table = this._table ?? this._resize();
    const bucket = table[hash & (table.length - 1)];
    for (const node of bucket) {
      if (node.hash === hash && node.key === key) {
        node.value = value;
        return this;
      }
    }
    bucket.push({ hash, key, value });
    if (++this._size > this._threshold) {
      this._resize();
    }
    return this;
  }

  public get(key: string): V | undefined {
    return this._find(key)?.value;
  }

  public has(key: string): boolean {
    return this._find(key) !== undefined;
  }

  public delete(key: string): boolean {
    if (this._table === undefined) {
      return false;
    }
    const hash = spread(javaStringHashCode(key));
    const bucket = this._table[hash & (this._table.length - 1)];
    const index = bucket.findIndex((node) => node.hash === hash && node.key === key);
    if (index < 0) {
      return false;
    }
    bucket.splice(index, 1);
    this._size--;
    return true;
  }

  public *entries(): IterableIterator<[string, V]> {
    for (const bucket of this._table ?? []) {
      for (const node of bucket) {
        yield [node.key, node.value];
      }
    }
  }

  public *keys(): IterableIterator<string> {
    for (const [key] of this.entries()) {
      yield key;
    }
  }

  public *values(): IterableIterator<V> {
    for (const [, value] of this.entries()) {
      yield value;
    }
  }

  private _find(key: string): Node<V> | undefined {
    if (this._table === undefined) {
      return undefined;
    }
    const hash = spread(javaStringHashCode(key));
    return this._table[hash & (this._table.length - 1)].find((node) => node.hash === hash && node.key === key);
  }

  private _resize(): Node<V>[][] {
    const oldTable = this._table;
    const oldCap = oldTable?.length ?? 0;
    let newCap: number;
    if (oldCap > 0) {
      newCap = oldCap * 2;
      this._threshold = this._threshold * 2;
    } else if (this._threshold > 0) {
      newCap = this._threshold;
      this._threshold = Math.floor(newCap * 0.75);
    } else {
      newCap = 16;
      this._threshold = 12;
    }
    const newTable: Node<V>[][] = Array.from({ length: newCap }, () => []);
    if (oldTable !== undefined) {
      for (const bucket of oldTable) {
        for (const node of bucket) {
          newTable[node.hash & (newCap - 1)].push(node);
        }
      }
    }
    this._table = newTable;
    return newTable;
  }
}
