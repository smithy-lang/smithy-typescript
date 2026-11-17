import type { StaticMapSchema, StaticStructureSchema } from "@smithy/types";
import { describe, expect, it } from "vitest";

import { cbor } from "./cbor";
import { CborShapeDeserializer } from "./codec-v1/CborShapeDeserializer";
import { CborShapeDeserializer2 } from "./codec-v2/CborShapeDeserializer2";

// ─── Minimal CBOR writer for the wire shapes used below ──────────────────────

function header(major: number, n: number): number[] {
  if (n < 24) {
    return [(major << 5) | n];
  }
  if (n < 256) {
    return [(major << 5) | 24, n];
  }
  if (n < 65536) {
    return [(major << 5) | 25, n >> 8, n & 0xff];
  }
  throw new Error(`test writer does not support length ${n}`);
}

function text(value: string): number[] {
  const bytes = [...Buffer.from(value, "utf8")];
  return [...header(3, bytes.length), ...bytes];
}

function uint(value: number): number[] {
  return header(0, value);
}

function bool(value: boolean): number[] {
  return [value ? 0xf5 : 0xf4];
}

function map(pairs: Array<[string, number[]]>): number[] {
  const out = [...header(5, pairs.length)];
  for (const [key, value] of pairs) {
    out.push(...text(key), ...value);
  }
  return out;
}

function indefiniteMap(pairs: Array<[string, number[]]>): number[] {
  const out = [0xbf];
  for (const [key, value] of pairs) {
    out.push(...text(key), ...value);
  }
  out.push(0xff);
  return out;
}

const bytes = (data: number[]): Uint8Array => Uint8Array.from(data);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const StringSchema = 0;
const DocumentSchema = 15;

const mapStrDoc: StaticMapSchema = [2, "ns", "MapStrDoc", 0, StringSchema, DocumentSchema];
const mapStrStr: StaticMapSchema = [2, "ns", "MapStrStr", 0, StringSchema, StringSchema];
const structMapStrDoc: StaticStructureSchema = [3, "ns", "Wrapper", 0, ["m"], [mapStrDoc]];

const de1 = new CborShapeDeserializer();
const de2 = new CborShapeDeserializer2();

const PROTO = "__proto__";
const adminObject = map([["admin", bool(true)]]);

/**
 * Wire map with a "__proto__" entry followed by filler entries, so the total
 * entry count can be set to 1, 24 (decodeMapSmall) or 25 (decodeMapLarge).
 */
function mapEntries(count: number, value: number[]): number[] {
  const pairs: Array<[string, number[]]> = [[PROTO, value]];
  for (let i = 0; i < count - 1; ++i) {
    pairs.push([`k${i}`, uint(i)]);
  }
  return map(pairs);
}

function indefiniteMapEntries(value: number[]): number[] {
  return indefiniteMap([
    [PROTO, value],
    ["a", uint(1)],
    ["b", uint(2)],
  ]);
}

function plainMapEntries(count: number): number[] {
  const pairs: Array<[string, number[]]> = [];
  for (let i = 0; i < count; ++i) {
    pairs.push([`k${i}`, uint(i)]);
  }
  return map(pairs);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("CBOR map keys named __proto__", () => {
  describe.each([1, 24, 25])("fixed-length map with %i entries", (count) => {
    it("decodes __proto__ as an own enumerable property, like JSON", () => {
      const decoded = cbor.deserialize(bytes(mapEntries(count, adminObject)));

      expect(Object.prototype.hasOwnProperty.call(decoded, PROTO)).toBe(true);
      expect(Object.keys(decoded)).toContain(PROTO);
      expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
      expect(decoded[PROTO]).toEqual({ admin: true });
      expect(decoded.admin).toBeUndefined();

      // The result is still a normal object for consumers that use these.
      expect(decoded.hasOwnProperty(PROTO)).toBe(true);
      expect(decoded instanceof Object).toBe(true);
      expect(JSON.stringify(decoded)).toContain('"__proto__"');
    });
  });

  it("decodes __proto__ in an indefinite-length map the same way", () => {
    const decoded = cbor.deserialize(bytes(indefiniteMapEntries(adminObject)));

    expect(Object.prototype.hasOwnProperty.call(decoded, PROTO)).toBe(true);
    expect(Object.keys(decoded)).toEqual([PROTO, "a", "b"]);
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(decoded[PROTO]).toEqual({ admin: true });
    expect(decoded.admin).toBeUndefined();
  });

  it("matches the JSON reference for the same logical document", () => {
    const json = JSON.parse('{"__proto__":{"admin":true}}');
    const decoded = cbor.deserialize(bytes(mapEntries(1, adminObject)));

    expect(Object.keys(decoded)).toEqual(Object.keys(json));
    expect(Object.getPrototypeOf(decoded)).toBe(Object.getPrototypeOf(json));
    expect(decoded[PROTO]).toEqual(json[PROTO]);
    expect(decoded.admin).toBe(json.admin);
  });

  it("does not change behaviour at the 24/25-entry boundary", () => {
    const small = cbor.deserialize(bytes(mapEntries(24, adminObject)));
    const large = cbor.deserialize(bytes(mapEntries(25, adminObject)));

    for (const decoded of [small, large]) {
      expect(Object.prototype.hasOwnProperty.call(decoded, PROTO)).toBe(true);
      expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
      expect(decoded[PROTO]).toEqual({ admin: true });
      expect(decoded.admin).toBeUndefined();
    }

    // The only difference between the two maps is one filler entry.
    expect(Object.keys(large).length - Object.keys(small).length).toBe(1);
  });

  it("preserves __proto__ through both schema-aware codecs for map<string, document>", () => {
    for (const count of [1, 24, 25]) {
      const wire = bytes(mapEntries(count, adminObject));
      for (const decoded of [de1.read(mapStrDoc, wire), de2.read(mapStrDoc, wire)]) {
        expect(Object.prototype.hasOwnProperty.call(decoded, PROTO)).toBe(true);
        expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
        expect(decoded[PROTO]).toEqual({ admin: true });
        expect(decoded.admin).toBeUndefined();
      }
    }
  });

  it("preserves __proto__ through both schema-aware codecs for a struct member", () => {
    for (const count of [24, 25]) {
      const wire = bytes(map([["m", mapEntries(count, adminObject)]]));
      for (const output of [de1.read(structMapStrDoc, wire), de2.read(structMapStrDoc, wire)]) {
        expect(Object.prototype.hasOwnProperty.call(output.m, PROTO)).toBe(true);
        expect(Object.getPrototypeOf(output.m)).toBe(Object.prototype);
        expect(output.m[PROTO]).toEqual({ admin: true });
        expect(output.m.admin).toBeUndefined();
      }
    }
  });

  it("preserves a __proto__ entry for map<string, string> instead of dropping it", () => {
    const wire = bytes(mapEntries(24, text("x")));

    const raw = cbor.deserialize(wire);
    expect(Object.keys(raw)).toContain(PROTO);
    expect(raw[PROTO]).toBe("x");
    expect(Object.getPrototypeOf(raw)).toBe(Object.prototype);

    for (const decoded of [de1.read(mapStrStr, wire), de2.read(mapStrStr, wire)]) {
      expect(Object.keys(decoded)).toContain(PROTO);
      expect(decoded[PROTO]).toBe("x");
      expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    }
  });

  it("preserves __proto__ when readValue() transforms a pre-decoded object", () => {
    const decoded = de2.readValue(mapStrDoc, JSON.parse('{"__proto__":{"admin":true}}'));

    expect(Object.prototype.hasOwnProperty.call(decoded, PROTO)).toBe(true);
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(decoded[PROTO]).toEqual({ admin: true });
    expect(decoded.admin).toBeUndefined();
  });

  it("does not fabricate a modeled struct member from an injected prototype", () => {
    // codec-v1 deserializes the raw map before applying the struct schema, so an
    // injected prototype used to satisfy a modeled member that was never on the wire.
    const structSchema: StaticStructureSchema = [3, "ns", "HasAdmin", 0, ["admin"], [StringSchema]];
    const wire = bytes(map([["__proto__", map([["admin", bool(true)]])]]));

    const decoded = de1.read(structSchema, wire);
    expect(decoded.admin).toBeUndefined();
  });

  it("round-trips the __proto__ entry through the CBOR encoder", () => {
    const decoded = cbor.deserialize(bytes(mapEntries(24, adminObject)));
    const roundTripped = cbor.deserialize(cbor.serialize(decoded));

    expect(Object.keys(roundTripped)).toEqual(Object.keys(decoded));
    expect(Object.prototype.hasOwnProperty.call(roundTripped, PROTO)).toBe(true);
    expect(roundTripped[PROTO]).toEqual({ admin: true });
    expect(Object.getPrototypeOf(roundTripped)).toBe(Object.prototype);
  });

  describe("control: ordinary maps are unaffected", () => {
    it("decodes an ordinary map with the same own keys and prototype as before", () => {
      const decoded = cbor.deserialize(bytes(plainMapEntries(3)));

      expect(decoded).toEqual({ k0: 0, k1: 1, k2: 2 });
      expect(Object.keys(decoded)).toEqual(["k0", "k1", "k2"]);
      expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
      expect(Object.prototype.hasOwnProperty.call(decoded, PROTO)).toBe(false);
    });

    it("agrees across the 24/25-entry boundary for ordinary maps", () => {
      const small = cbor.deserialize(bytes(plainMapEntries(24)));
      const large = cbor.deserialize(bytes(plainMapEntries(25)));

      expect(Object.keys(small)).toEqual(Array.from({ length: 24 }, (_, i) => `k${i}`));
      expect(Object.keys(large)).toEqual(Array.from({ length: 25 }, (_, i) => `k${i}`));
      expect(Object.getPrototypeOf(small)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(large)).toBe(Object.prototype);
      for (let i = 0; i < 24; ++i) {
        expect(small[`k${i}`]).toBe(i);
        expect(large[`k${i}`]).toBe(i);
      }
    });

    it("decodes ordinary map<string, string> values through both codecs", () => {
      const wire = bytes(
        map([
          ["a", text("x")],
          ["b", text("y")],
        ])
      );
      for (const decoded of [de1.read(mapStrStr, wire), de2.read(mapStrStr, wire)]) {
        expect(decoded).toEqual({ a: "x", b: "y" });
        expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
      }
    });
  });
});
