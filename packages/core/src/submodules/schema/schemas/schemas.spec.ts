import { SchemaRef, SchemaTraits } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { TypeRegistry } from "../TypeRegistry";
import { error, ErrorSchema } from "./ErrorSchema";
import { list, ListSchema } from "./ListSchema";
import { map, MapSchema } from "./MapSchema";
import { op, OperationSchema } from "./OperationSchema";
import { Schema } from "./Schema";
import { SCHEMA } from "./sentinels";
import { sim, SimpleSchema } from "./SimpleSchema";
import { struct, StructureSchema } from "./StructureSchema";

describe("schemas", () => {
  describe("sentinels", () => {
    it("should be constant", () => {
      expect(SCHEMA).toEqual({
        BLOB: 0b0001_0101, // 21
        STREAMING_BLOB: 0b0010_1010, // 42
        BOOLEAN: 0b0000_0010, // 2
        STRING: 0b0000_0000, // 0
        NUMERIC: 0b0000_0001, // 1
        BIG_INTEGER: 0b0001_0001, // 17
        BIG_DECIMAL: 0b0001_0011, // 19
        DOCUMENT: 0b0000_1111, // 15
        TIMESTAMP_DEFAULT: 0b0000_0100, // 4
        TIMESTAMP_DATE_TIME: 0b0000_0101, // 5
        TIMESTAMP_HTTP_DATE: 0b0000_0110, // 6
        TIMESTAMP_EPOCH_SECONDS: 0b0000_0111, // 7
        LIST_MODIFIER: 0b0100_0000, // 64
        MAP_MODIFIER: 0b1000_0000, // 128
      });
    });
  });

  describe(ErrorSchema.name, () => {
    const schema = new ErrorSchema("ack#Error", 0, [], [], Error);

    it("is a StructureSchema", () => {
      expect(schema).toBeInstanceOf(StructureSchema);
    });

    it("additionally defines an error constructor", () => {
      expect(schema.ctor).toBeInstanceOf(Function);
      expect(new schema.ctor()).toBeInstanceOf(schema.ctor);
    });

    it("has a factory and the factory registers the schema", () => {
      expect(error("ack", "Error", 0, [], [], Error)).toEqual(schema);
      expect(TypeRegistry.for("ack").getSchema(schema.name)).toEqual(schema);
    });

    it("has an instanceOf operator", () => {
      const object = { ...schema };
      expect(ErrorSchema.prototype.isPrototypeOf(object)).toBe(false);
      expect(object).toBeInstanceOf(ErrorSchema);
    });
  });
  describe(ListSchema.name, () => {
    const schema = new ListSchema("ack#List", 0, 0);
    it("is a Schema", () => {
      expect(schema).toBeInstanceOf(Schema);
    });
    it("has a value schema", () => {
      expect(schema.valueSchema).toBe(0 as SchemaRef);
    });
    it("has a factory and the factory registers the schema", () => {
      expect(list("ack", "List", 0, 0)).toEqual(schema);
      expect(TypeRegistry.for("ack").getSchema(schema.name)).toEqual(schema);
    });
    it("has an instanceOf operator", () => {
      const object = { ...schema };
      expect(ListSchema.prototype.isPrototypeOf(object)).toBe(false);
      expect(object).toBeInstanceOf(ListSchema);
    });
  });
  describe(MapSchema.name, () => {
    const schema = new MapSchema("ack#Map", 0, 0, 1);
    it("is a Schema", () => {
      expect(schema).toBeInstanceOf(Schema);
    });
    it("has a key and value schema", () => {
      expect(schema.keySchema).toBe(0 as SchemaRef);
      expect(schema.valueSchema).toBe(1 as SchemaRef);
    });
    it("has a factory and the factory registers the schema", () => {
      expect(map("ack", "Map", 0, 0, 1)).toEqual(schema);
      expect(TypeRegistry.for("ack").getSchema(schema.name)).toEqual(schema);
    });
    it("has an instanceOf operator", () => {
      const object = { ...schema };
      expect(MapSchema.prototype.isPrototypeOf(object)).toBe(false);
      expect(object).toBeInstanceOf(MapSchema);
    });
  });
  describe(OperationSchema.name, () => {
    const schema = new OperationSchema("ack#Operation", 0, "unit", "unit");
    it("is a Schema", () => {
      expect(schema).toBeInstanceOf(Schema);
    });
    it("has an input and output schema", () => {
      expect(schema.input).toEqual("unit");
      expect(schema.output).toEqual("unit");
    });
    it("has a factory and the factory registers the schema", () => {
      expect(op("ack", "Operation", 0, "unit", "unit")).toEqual(schema);
      expect(TypeRegistry.for("ack").getSchema(schema.name)).toEqual(schema);
    });
  });
  describe(Schema.name, () => {
    const schema = new (class extends Schema {
      public constructor(name: string, traits: SchemaTraits) {
        super(name, traits);
      }
    })("ack#Abstract", {
      a: 0,
      b: 1,
    });
    it("has a name", () => {
      expect(schema.name).toBe("ack#Abstract");
    });
    it("has traits", () => {
      expect(schema.traits).toEqual({
        a: 0,
        b: 1,
      });
    });
  });
  describe(SimpleSchema.name, () => {
    const schema = new SimpleSchema("ack#Simple", 0, 0);
    it("is a Schema", () => {
      expect(schema).toBeInstanceOf(Schema);
    });
    it("has a factory and the factory registers the schema", () => {
      expect(sim("ack", "Simple", 0, 0)).toEqual(schema);
      expect(TypeRegistry.for("ack").getSchema(schema.name)).toEqual(schema);
    });
    it("has an instanceOf operator", () => {
      const object = { ...schema };
      expect(SimpleSchema.prototype.isPrototypeOf(object)).toBe(false);
      expect(object).toBeInstanceOf(SimpleSchema);
    });
  });
  describe(StructureSchema.name, () => {
    const schema = new StructureSchema("ack#Structure", 0, ["a", "b", "c"], [0, 1, 2]);
    it("is a Schema", () => {
      expect(schema).toBeInstanceOf(Schema);
    });
    it("has member schemas", () => {
      expect(schema.members).toEqual({
        a: [0 as SchemaRef, 0 as SchemaTraits],
        b: [1 as SchemaRef, 0 as SchemaTraits],
        c: [2 as SchemaRef, 0 as SchemaTraits],
      });
    });
    it("has a factory and the factory registers the schema", () => {
      expect(struct("ack", "Structure", 0, ["a", "b", "c"], [0, 1, 2])).toEqual(schema);
      expect(TypeRegistry.for("ack").getSchema(schema.name)).toEqual(schema);
    });
    it("has an instanceOf operator", () => {
      const object = { ...schema };
      expect(StructureSchema.prototype.isPrototypeOf(object)).toBe(false);
      expect(object).toBeInstanceOf(StructureSchema);
    });
  });
});
