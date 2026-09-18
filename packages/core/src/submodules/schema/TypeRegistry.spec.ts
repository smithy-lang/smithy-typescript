import type { StaticErrorSchema, StaticListSchema, StaticMapSchema, StaticStructureSchema } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { TypeRegistry } from "./TypeRegistry";

describe(TypeRegistry.name, () => {
  const [List, Map, Struct]: [StaticListSchema, StaticMapSchema, () => StaticStructureSchema] = [
    [1, "NAMESPACE", "List", { sparse: 1 }, 0],
    [2, "NAMESPACE", "Map", 0, 0, 1],
    () => schema,
  ];
  const schema: StaticStructureSchema = [
    3,
    "NAMESPACE",
    "Structure",
    {},
    ["list", "map", "struct"],
    [List, Map, Struct],
  ];

  it("stores and retrieves schema objects", () => {
    const tr = TypeRegistry.for("NAMESPACE");

    tr.register(`${List[1]}#${List[2]}`, List);
    expect(tr.getSchema("List")).toBe(List);

    tr.register(`${Map[1]}#${Map[2]}`, Map);
    expect(tr.getSchema("Map")).toBe(Map);

    tr.register(`${Struct()[1]}#${Struct()[2]}`, Struct());
    expect(tr.getSchema("Structure")).toBe(schema);
  });

  it("has a helper method to retrieve a synthetic base exception", () => {
    // the service namespace is appended to the synthetic prefix.
    const err = [
      -3,
      "smithy.ts.sdk.synthetic.NAMESPACE",
      "UhOhServiceException",
      0,
      [],
      [],
    ] satisfies StaticErrorSchema;
    const tr = TypeRegistry.for(err[1]);
    tr.registerError(err, Error);
    expect(tr.getBaseException()).toBe(err);
  });

  describe("registerError", () => {
    const makeErr = (ns: string, name: string) => [-3, ns, name, 0, [], []] satisfies StaticErrorSchema;

    it("registers schema and constructor in lockstep (first writer wins)", () => {
      const tr = TypeRegistry.for("com.err.a");
      const first = makeErr("com.err.a", "Boom");
      const second = makeErr("com.err.a", "Boom");
      class FirstCtor extends Error {}
      class SecondCtor extends Error {}

      tr.registerError(first, FirstCtor);
      // same qualified key; must be skipped, not overwritten.
      tr.registerError(second, SecondCtor);

      expect(tr.getSchema("com.err.a#Boom")).toBe(first);
      expect(tr.getErrorCtor(first)).toBe(FirstCtor);
      // the second schema object was never registered, so it has no ctor.
      expect(tr.getErrorCtor(second)).toBeUndefined();
    });

    it("does not half-register when the schema key already exists (no orphan ctor)", () => {
      const tr = TypeRegistry.for("com.err.b");
      // A plain schema claims the key first (no exception recorded).
      tr.register("com.err.b#Clash", List);
      const err = makeErr("com.err.b", "Clash");
      class ClashCtor extends Error {}

      tr.registerError(err, ClashCtor);

      // Lockstep guard: schema key present, so neither map is written.
      expect(tr.getSchema("com.err.b#Clash")).toBe(List);
      expect(tr.getErrorCtor(err)).toBeUndefined();
    });

    it("also registers into the qualified-namespace registry", () => {
      const local = TypeRegistry.for("com.err.c.local");
      const err = makeErr("com.err.c", "CrossNs");
      class CrossCtor extends Error {}

      local.registerError(err, CrossCtor);

      // registerError writes into `this` AND TypeRegistry.for(ns).
      expect(local.getSchema("com.err.c#CrossNs")).toBe(err);
      expect(TypeRegistry.for("com.err.c").getSchema("com.err.c#CrossNs")).toBe(err);
      expect(TypeRegistry.for("com.err.c").getErrorCtor(err)).toBe(CrossCtor);
    });
  });

  describe("unqualified shapeId lookup", () => {
    it("resolves an unqualified name when there is exactly one matching schema", () => {
      const tr = TypeRegistry.for("com.unrelated");
      tr.register("com.example#MyShape", List);
      expect(tr.getSchema("MyShape")).toBe(List);
    });

    it("throws when an unqualified name matches multiple schemas", () => {
      const tr = TypeRegistry.for("com.unrelated");
      tr.register("com.example#Ambiguous", List);
      tr.register("com.other#Ambiguous", Map);
      expect(() => tr.getSchema("Ambiguous")).toThrow("schema not found");
    });

    it("throws when an unqualified name matches no schemas", () => {
      const tr = TypeRegistry.for("com.unrelated");
      tr.register("com.example#Exists", List);
      expect(() => tr.getSchema("DoesNotExist")).toThrow("schema not found");
    });
  });

  describe("composition", () => {
    it("can be composed", () => {
      const tr1 = TypeRegistry.for("namespace");
      const tr2 = TypeRegistry.for("other");

      tr1.register("namespace#List", List);
      tr2.register("other#List", List);

      tr1.copyFrom(tr2);
      tr2.copyFrom(tr1);

      expect(tr1.getSchema("other#List")).toBe(List);
      expect(tr2.getSchema("namespace#List")).toBe(List);

      expect(() => tr1.getSchema("List")).not.toThrow();
      expect(() => tr2.getSchema("List")).not.toThrow();
    });

    it("does not overwrite during composition (first writer wins)", () => {
      const nsRegistry = TypeRegistry.for("namespace");
      const otherRegistry = TypeRegistry.for("other");

      // register() also writes into the registry of the qualified namespace
      // (TypeRegistry.for(ns)), so the FIRST write of a given qualified key
      // wins in both registries; later writes of the same key are skipped.

      // First writer of "namespace#Value" is otherRegistry.register(...1),
      // which also seeds nsRegistry via for("namespace"). Value: 1.
      otherRegistry.register("namespace#Value", 1);
      // Skipped in nsRegistry (key already present).
      nsRegistry.register("namespace#Value", 0);

      // First writer of "other#Value" is nsRegistry.register(...1),
      // which also seeds otherRegistry via for("other"). Value: 1.
      nsRegistry.register("other#Value", 1);
      // Skipped in otherRegistry (key already present).
      otherRegistry.register("other#Value", 0);

      nsRegistry.copyFrom(otherRegistry);
      otherRegistry.copyFrom(nsRegistry);

      // Both registries hold the first-written value for each key; copyFrom
      // is additive and never overwrites.
      expect(nsRegistry.getSchema("namespace#Value")).toBe(1);
      expect(nsRegistry.getSchema("other#Value")).toBe(1);

      expect(otherRegistry.getSchema("namespace#Value")).toBe(1);
      expect(otherRegistry.getSchema("other#Value")).toBe(1);
    });
  });
});
