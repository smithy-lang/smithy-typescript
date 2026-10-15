import { describe, expect, it, vi } from "vitest";

import { SchemaExtensionKey } from "./SchemaExtension";

describe(SchemaExtensionKey.name, () => {
  it("computes an extension once per cache owner", () => {
    const provide = vi.fn((schema: { value: number }) => schema.value * 2);
    const key = new SchemaExtensionKey({ provide });
    const schema = { value: 4 };

    expect(key.get(schema)).toBe(8);
    expect(key.get(schema)).toBe(8);
    expect(provide).toHaveBeenCalledOnce();
  });

  it("supports a distinct cache owner", () => {
    const provide = vi.fn((schema: { value: number }) => schema.value);
    const key = new SchemaExtensionKey({ provide });
    const cacheOwner = {};

    expect(key.get({ value: 1 }, cacheOwner)).toBe(1);
    expect(key.get({ value: 2 }, cacheOwner)).toBe(1);
    expect(provide).toHaveBeenCalledOnce();
  });

  it("caches undefined values and supports frozen schemas", () => {
    const provide = vi.fn(() => undefined);
    const key = new SchemaExtensionKey({ provide });
    const schema = Object.freeze({});

    expect(key.get(schema)).toBeUndefined();
    expect(key.get(schema)).toBeUndefined();
    expect(provide).toHaveBeenCalledOnce();
  });
});
