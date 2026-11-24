import { ModelSyntaxException } from "../exceptions/exceptions";
import { Model } from "../Model";
import { Nodes } from "../node/Nodes";
import type { JsonObject } from "../node/Nodes";
import { ListShape, MapShape, SetShape, StructureShape, UnionShape } from "../shapes/AggregateShapes";
import { MemberShape } from "../shapes/MemberShape";
import { OperationShape, ResourceShape, ServiceShape } from "../shapes/ServiceShapes";
import type { Shape } from "../shapes/Shape";
import { ShapeId } from "../shapes/ShapeId";
import {
  BigDecimalShape,
  BigIntegerShape,
  BlobShape,
  BooleanShape,
  ByteShape,
  DocumentShape,
  DoubleShape,
  EnumShape,
  FloatShape,
  IntEnumShape,
  IntegerShape,
  LongShape,
  ShortShape,
  StringShape,
  TimestampShape,
} from "../shapes/SimpleShapes";
import { makeAbsoluteTraitName } from "../traits/Trait";
import type { Trait } from "../traits/Trait";
import { TraitFactory } from "../traits/TraitFactory";
import { Prelude } from "./Prelude";

/**
 * Loads a Smithy JSON AST into a {@link Model}.
 *
 * Mixin members are resolved the way Smithy's ModelAssembler resolves them, and the prelude shapes are always present.
 *
 * @internal
 */
export class ModelLoader {
  private readonly _shapes: JsonObject;
  private readonly _applied = new Map<ShapeId, Array<[ShapeId, unknown]>>();
  private readonly _built = new Map<ShapeId, Shape>();
  private readonly _building = new Set<ShapeId>();

  private constructor(shapes: JsonObject) {
    this._shapes = shapes;
  }

  public static load(ast: unknown): Model {
    const root = Nodes.expectObject(ast, "A Smithy JSON AST must be an object");
    const version = root.smithy;
    if (version !== "2.0" && version !== "2" && version !== "1.0") {
      throw new ModelSyntaxException("Unsupported Smithy version in JSON AST: " + String(version));
    }
    const metadata = new Map<string, unknown>();
    const metadataNode = Nodes.getObject(root, "metadata");
    if (metadataNode !== undefined) {
      for (const key of Object.keys(metadataNode)) {
        metadata.set(key, metadataNode[key]);
      }
    }
    const loader = new ModelLoader(Nodes.getObject(root, "shapes") ?? {});
    return new Model(loader._buildAll(), metadata);
  }

  private _buildAll(): Shape[] {
    const shapes: Shape[] = Prelude.getPreludeShapes().slice();
    const ids = Object.keys(this._shapes);
    for (const key of ids) {
      const node = Nodes.expectObject(this._shapes[key]);
      if (node.type === "apply") {
        this._collectApply(ShapeId.from(key), node);
      }
    }
    for (const key of ids) {
      if (Nodes.expectObject(this._shapes[key]).type !== "apply") {
        shapes.push(this._build(ShapeId.from(key)));
      }
    }
    return shapes;
  }

  private _collectApply(id: ShapeId, node: JsonObject): void {
    const traits = Nodes.getObject(node, "traits") ?? {};
    let list = this._applied.get(id);
    if (list === undefined) {
      list = [];
      this._applied.set(id, list);
    }
    for (const traitName of Object.keys(traits)) {
      list.push([ShapeId.from(makeAbsoluteTraitName(traitName)), traits[traitName]]);
    }
  }

  private _build(id: ShapeId): Shape {
    const existing = this._built.get(id);
    if (existing !== undefined) {
      return existing;
    }
    const preludeShape = Prelude.getPreludeShapes().find((shape) => shape.getId() === id);
    if (preludeShape !== undefined) {
      return preludeShape;
    }
    const raw = this._shapes[id.toString()];
    if (raw === undefined) {
      throw new ModelSyntaxException("Shape not found in the JSON AST: " + id);
    }
    if (this._building.has(id)) {
      throw new ModelSyntaxException("Mixin cycle detected at shape: " + id);
    }
    this._building.add(id);
    const shape = this._create(id, Nodes.expectObject(raw));
    this._building.delete(id);
    this._built.set(id, shape);
    return shape;
  }

  private _create(id: ShapeId, node: JsonObject): Shape {
    const type = Nodes.expectString(Nodes.expectMember(node, "type"), "Shape `" + id + "` must define a type");
    const traits = this._readTraits(id, node);
    const mixins = this._readMixins(node);
    const base = { id, traits, mixins };
    switch (type) {
      case "blob":
        return new BlobShape(base);
      case "boolean":
        return new BooleanShape(base);
      case "string":
        return new StringShape(base);
      case "timestamp":
        return new TimestampShape(base);
      case "byte":
        return new ByteShape(base);
      case "short":
        return new ShortShape(base);
      case "integer":
        return new IntegerShape(base);
      case "long":
        return new LongShape(base);
      case "float":
        return new FloatShape(base);
      case "document":
        return new DocumentShape(base);
      case "double":
        return new DoubleShape(base);
      case "bigDecimal":
        return new BigDecimalShape(base);
      case "bigInteger":
        return new BigIntegerShape(base);
      case "enum":
        return new EnumShape({ ...base, members: this._readMembers(id, node) });
      case "intEnum":
        return new IntEnumShape({ ...base, members: this._readMembers(id, node) });
      case "list":
        return new ListShape({ ...base, members: this._readSingleMember(id, node, "member") });
      case "set":
        return new SetShape({ ...base, members: this._readSingleMember(id, node, "member") });
      case "map":
        return new MapShape({
          ...base,
          members: this._readSingleMember(id, node, "key").concat(this._readSingleMember(id, node, "value")),
        });
      case "structure":
        return new StructureShape({ ...base, members: this._readMembers(id, node) });
      case "union":
        return new UnionShape({ ...base, members: this._readMembers(id, node) });
      case "service":
        return this._createService(base, node);
      case "resource":
        return this._createResource(base, node);
      case "operation":
        return this._createOperation(base, node);
      default:
        throw new ModelSyntaxException("Unknown shape type `" + type + "` for shape `" + id + "`");
    }
  }

  private _createService(base: { id: ShapeId; traits: Trait[]; mixins: Shape[] }, node: JsonObject): ServiceShape {
    const rename = new Map<ShapeId, string>();
    const renameNode = Nodes.getObject(node, "rename");
    if (renameNode !== undefined) {
      for (const key of Object.keys(renameNode)) {
        rename.set(ShapeId.from(key), Nodes.expectString(renameNode[key]));
      }
    }
    return new ServiceShape({
      ...base,
      version: Nodes.getString(node, "version") ?? "",
      operations: this._readReferences(node, "operations"),
      resources: this._readReferences(node, "resources"),
      errors: this._readReferences(node, "errors"),
      rename,
    });
  }

  private _createResource(base: { id: ShapeId; traits: Trait[]; mixins: Shape[] }, node: JsonObject): ResourceShape {
    return new ResourceShape({
      ...base,
      operations: this._readReferences(node, "operations"),
      resources: this._readReferences(node, "resources"),
      collectionOperations: this._readReferences(node, "collectionOperations"),
      identifiers: this._readReferenceMap(node, "identifiers"),
      properties: this._readReferenceMap(node, "properties"),
      put: this._readReference(node, "put"),
      create: this._readReference(node, "create"),
      read: this._readReference(node, "read"),
      update: this._readReference(node, "update"),
      delete: this._readReference(node, "delete"),
      list: this._readReference(node, "list"),
    });
  }

  private _createOperation(base: { id: ShapeId; traits: Trait[]; mixins: Shape[] }, node: JsonObject): OperationShape {
    return new OperationShape({
      ...base,
      input: this._readReference(node, "input"),
      output: this._readReference(node, "output"),
      errors: this._readReferences(node, "errors"),
    });
  }

  private _readTraits(id: ShapeId, node: JsonObject): Trait[] {
    const traits = Nodes.getObject(node, "traits") ?? {};
    const result: Trait[] = [];
    for (const traitName of Object.keys(traits)) {
      result.push(this._createTrait(id, ShapeId.from(makeAbsoluteTraitName(traitName)), traits[traitName]));
    }
    const applied = this._applied.get(id);
    if (applied !== undefined) {
      for (const [traitId, value] of applied) {
        result.push(this._createTrait(id, traitId, value));
      }
    }
    return result;
  }

  private _createTrait(target: ShapeId, traitId: ShapeId, value: unknown): Trait {
    try {
      return TraitFactory.createTrait(traitId, value);
    } catch (e) {
      throw new ModelSyntaxException(
        "Error applying trait `" + traitId + "` to `" + target + "`: " + (e as Error).message
      );
    }
  }

  private _readMixins(node: JsonObject): Shape[] {
    const mixins = Nodes.getArray(node, "mixins");
    if (mixins === undefined) {
      return [];
    }
    return mixins.map((entry) =>
      this._build(ShapeId.from(Nodes.expectString(Nodes.expectMember(Nodes.expectObject(entry), "target"))))
    );
  }

  private _readMembers(id: ShapeId, node: JsonObject): MemberShape[] {
    const members = Nodes.getObject(node, "members");
    if (members === undefined) {
      return [];
    }
    return Object.keys(members).map((name) => this._readMember(id, name, members[name]));
  }

  private _readSingleMember(id: ShapeId, node: JsonObject, name: string): MemberShape[] {
    const member = node[name];
    return member === undefined ? [] : [this._readMember(id, name, member)];
  }

  private _readMember(container: ShapeId, name: string, raw: unknown): MemberShape {
    const node = Nodes.expectObject(raw);
    const memberId = container.withMember(name);
    return new MemberShape({
      id: memberId,
      target: ShapeId.from(Nodes.expectString(Nodes.expectMember(node, "target"))),
      traits: this._readTraits(memberId, node),
    });
  }

  private _readReference(node: JsonObject, key: string): ShapeId | undefined {
    const value = node[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    return ShapeId.from(Nodes.expectString(Nodes.expectMember(Nodes.expectObject(value), "target")));
  }

  private _readReferences(node: JsonObject, key: string): ShapeId[] {
    const values = Nodes.getArray(node, key);
    if (values === undefined) {
      return [];
    }
    return values.map((entry) =>
      ShapeId.from(Nodes.expectString(Nodes.expectMember(Nodes.expectObject(entry), "target")))
    );
  }

  private _readReferenceMap(node: JsonObject, key: string): Map<string, ShapeId> {
    const result = new Map<string, ShapeId>();
    const object = Nodes.getObject(node, key);
    if (object !== undefined) {
      for (const name of Object.keys(object)) {
        result.set(
          name,
          ShapeId.from(Nodes.expectString(Nodes.expectMember(Nodes.expectObject(object[name]), "target")))
        );
      }
    }
    return result;
  }
}
