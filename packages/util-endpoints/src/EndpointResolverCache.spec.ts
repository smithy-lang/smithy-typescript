import { EndpointResolverCache } from "./EndpointResolverCache";

describe(EndpointResolverCache.name, () => {
  it("can generate string keys", () => {
    const cache = new EndpointResolverCache();
    const key = cache.key({
      a: "a",
      b: false,
    });
    expect(key).toEqual("a=(string)a,b=(boolean)false,");
  });

  it("can write and retrieve entries", () => {
    const dummyEndpoint = {} as any;
    const cache = new EndpointResolverCache();
    cache.set("a", dummyEndpoint);
    expect(cache.get("a")).toBe(dummyEndpoint);
    expect(cache.get("a")).toBe(dummyEndpoint);
    expect(cache.get("b")).toBeUndefined();
  });

  it("maintains a maximum capacity", () => {
    const dummyEndpoint = {} as any;
    const cache = new EndpointResolverCache(3);
    cache.set("a", dummyEndpoint);
    cache.set("b", dummyEndpoint);
    cache.set("c", dummyEndpoint);
    cache.set("d", dummyEndpoint);
    cache.set("e", dummyEndpoint);
    cache.set("f", dummyEndpoint);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBeUndefined();
    expect(cache.get("d")).toBe(dummyEndpoint);
    expect(cache.get("e")).toBe(dummyEndpoint);
    expect(cache.get("f")).toBe(dummyEndpoint);
  });

  it("can be cleared", () => {
    const dummyEndpoint = {} as any;
    const cache = new EndpointResolverCache(3);
    cache.set("a", dummyEndpoint);
    cache.set("b", dummyEndpoint);
    cache.set("c", dummyEndpoint);
    cache.set("d", dummyEndpoint);
    cache.set("e", dummyEndpoint);
    cache.set("f", dummyEndpoint);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBeUndefined();
    expect(cache.get("d")).toBeUndefined();
    expect(cache.get("e")).toBeUndefined();
    expect(cache.get("f")).toBeUndefined();
  });
});
