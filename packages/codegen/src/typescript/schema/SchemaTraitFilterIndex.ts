import type { Model, Shape } from "../../model";
import { AuthDefinitionTrait, ProtocolDefinitionTrait, ShapeId, TreeSet } from "../../model";
import { SchemaTraitExtension } from "./SchemaTraitExtension";

const id = (name: string): string => ShapeId.from("smithy.api#" + name).toString();

const EXCLUDED_TRAITS = new Set([id("timestampFormat"), id("requestCompression")]);
const DEFAULT_INCLUDED_TRAITS = [
  "sparse",
  "sensitive",
  "idempotencyToken",
  "jsonName",
  "mediaType",
  "xmlAttribute",
  "xmlFlattened",
  "xmlName",
  "xmlNamespace",
  "streaming",
  "endpoint",
  "error",
  "requiresLength",
  "eventHeader",
  "eventPayload",
  "httpError",
  "http",
  "httpHeader",
  "httpQuery",
  "httpLabel",
  "httpPayload",
  "httpPrefixHeaders",
  "httpQueryParams",
  "httpResponseCode",
  "hostLabel",
].map(id);

/**
 * Decides which traits are carried into generated schemas.
 */
export class SchemaTraitFilterIndex {
  private readonly _includedTraits = new Set<string>(DEFAULT_INCLUDED_TRAITS);
  private readonly _cache = new Map<Shape, boolean>();
  private readonly _model: Model;

  public constructor(model: Model) {
    const definitionShapes = new TreeSet<Shape>();
    for (const shape of [
      ...model.getShapesWithTrait(ProtocolDefinitionTrait),
      ...model.getShapesWithTrait(AuthDefinitionTrait),
    ]) {
      definitionShapes.add(shape);
    }
    for (const shape of definitionShapes) {
      const protocolDefinition = shape.getTrait(ProtocolDefinitionTrait);
      if (protocolDefinition !== undefined) {
        for (const traitShapeId of protocolDefinition.getTraits()) {
          if (!EXCLUDED_TRAITS.has(traitShapeId.toString())) {
            this._includedTraits.add(traitShapeId.toString());
          }
        }
      }
    }
    this._model = model;
    for (const shape of model.toSet()) {
      this._cache.set(shape, this.hasSchemaTraits(shape));
    }
  }

  public static of(model: Model): SchemaTraitFilterIndex {
    return model.getKnowledge(SchemaTraitFilterIndex, (m) => new SchemaTraitFilterIndex(m));
  }

  public includeTrait(traitShapeId: ShapeId): boolean {
    return this._includedTraits.has(traitShapeId.toString()) || SchemaTraitExtension.INSTANCE.contains(traitShapeId);
  }

  public hasSchemaTraits(shape: Shape, depth = 0): boolean {
    const cached = this._cache.get(shape);
    if (cached !== undefined) {
      return cached;
    }
    if (depth > 20) {
      return false;
    }
    for (const traitId of shape.getAllTraits().keys()) {
      if (this.includeTrait(traitId)) {
        this._cache.set(shape, true);
        return true;
      }
    }
    let membersHaveSchemaTraits = false;
    for (const member of shape.getAllMembers().values()) {
      if (this.hasSchemaTraits(member, depth + 1)) {
        membersHaveSchemaTraits = true;
        break;
      }
    }
    const asMember = shape.asMemberShape();
    const targetHasSchemaTraits =
      asMember !== undefined && this.hasSchemaTraits(this._model.expectShape(asMember.getTarget()), depth + 1);
    const result = membersHaveSchemaTraits || targetHasSchemaTraits;
    this._cache.set(shape, result);
    return result;
  }
}
