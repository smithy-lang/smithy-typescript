import { describe, expect, it } from "vitest";

import { TreeMap } from "../../../src/model/utils/TreeMap";
import { TreeSet } from "../../../src/model/utils/TreeSet";

describe("TreeMap", () => {
  it("iterates in key order regardless of insertion order", () => {
    const map = new TreeMap<string, number>();
    map.set("b", 2).set("c", 3).set("a", 1);
    expect([...map.keys()]).toEqual(["a", "b", "c"]);
    expect([...map.values()]).toEqual([1, 2, 3]);
    expect([...map].map(([key]) => key)).toEqual(["a", "b", "c"]);
  });

  it("looks up keys before and after the sort", () => {
    const map = new TreeMap<string, number>();
    map.set("b", 2).set("a", 1);
    expect(map.get("a")).toBe(1);
    expect([...map.keys()]).toEqual(["a", "b"]);
    map.set("c", 3).set("a", 10);
    expect(map.get("c")).toBe(3);
    expect(map.get("a")).toBe(10);
    expect(map.size).toBe(3);
    expect([...map.entries()]).toEqual([
      ["a", 10],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("treats keys as equal when the comparator returns zero", () => {
    const map = new TreeMap<string, number>((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    map.set("A", 1).set("a", 2);
    expect(map.size).toBe(1);
    expect(map.get("A")).toBe(2);
  });

  it("deletes from the sorted and unsorted parts", () => {
    const map = new TreeMap<number, string>();
    map.set(3, "c").set(1, "a");
    expect([...map.keys()]).toEqual([1, 3]);
    map.set(2, "b");
    expect(map.delete(1)).toBe(true);
    expect(map.delete(2)).toBe(true);
    expect(map.delete(9)).toBe(false);
    expect([...map.keys()]).toEqual([3]);
    expect(map.firstKey()).toBe(3);
  });
});

describe("TreeSet", () => {
  it("iterates in order and deduplicates", () => {
    const set = new TreeSet<string>(["b", "a", "b", "c"]);
    expect([...set]).toEqual(["a", "b", "c"]);
    expect(set.has("a")).toBe(true);
    set.delete("a");
    expect([...set.values()]).toEqual(["b", "c"]);
    expect(set.first()).toBe("b");
    expect(set.last()).toBe("c");
  });

  it("accepts a comparator", () => {
    const set = new TreeSet<number>([1, 3, 2], (a, b) => b - a);
    expect([...set]).toEqual([3, 2, 1]);
  });
});
