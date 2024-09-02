import { EndpointCache } from "./EndpointCache";

describe(EndpointCache.name, () => {
  const endpoint1: any = {};
  const endpoint2: any = {};

  it("should store and retrieve items", () => {
    const cache = new EndpointCache({
      size: 50,
    });

    expect(cache.get({ A: "b", B: "b" }, () => endpoint1)).toBe(endpoint1);
    expect(cache.get({ A: "b", B: "b" }, () => endpoint1)).toBe(endpoint1);
    expect(cache.get({ A: "b", B: "b", C: "c" }, () => endpoint1)).toBe(endpoint1);
    expect(cache.get({ A: "b", B: "b", C: "c" }, () => endpoint1)).toBe(endpoint1);
    expect(cache.get({ A: "b", B: "b", C: "cc" }, () => endpoint2)).toBe(endpoint2);
    expect(cache.get({ A: "b", B: "b", C: "cc" }, () => endpoint2)).toBe(endpoint2);

    expect(cache.size()).toEqual(3);
  });

  it("should accept a custom parameter list", () => {
    const cache = new EndpointCache({
      size: 50,
      params: ["A", "B"],
    });

    expect(cache.get({ A: "b", B: "b" }, () => endpoint1)).toBe(endpoint1);
    expect(cache.get({ A: "b", B: "b", C: "c" }, () => endpoint1)).toBe(endpoint1);
    expect(cache.get({ A: "b", B: "b", C: "cc" }, () => endpoint2)).toBe(endpoint1);

    expect(cache.size()).toEqual(1);
  });

  it("should be an LRU cache", () => {
    const cache = new EndpointCache({
      size: 5,
      params: ["A", "B"],
    });

    for (let i = 0; i < 50; ++i) {
      cache.get({ A: "b", B: "b" + i }, () => endpoint1);
    }

    const size = cache.size();
    expect(size).toBeLessThan(16);
    expect(cache.get({ A: "b", B: "b49" }, () => endpoint2)).toBe(endpoint1);
    expect(cache.size()).toEqual(size);

    expect(cache.get({ A: "b", B: "b1" }, () => endpoint2)).toBe(endpoint2);
    expect(cache.size()).toEqual(size + 1);
  });
});
