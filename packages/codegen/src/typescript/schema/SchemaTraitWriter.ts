import { type Shape, ShapeId, TreeMap } from "../../model";
import type { StringStore } from "../util";
import type { SchemaReferenceIndex } from "./SchemaReferenceIndex";
import { SchemaTraitGenerator } from "./SchemaTraitGenerator";

const COMPRESS_TRAITS = [
  "httpLabel",
  "idempotent",
  "idempotencyToken",
  "sensitive",
  "httpPayload",
  "httpResponseCode",
  "httpQueryParams",
].map((name) => ShapeId.from("smithy.api#" + name));

const traitGenerator = new SchemaTraitGenerator();

/**
 * Renders the traits of a shape as a bit vector or an object literal.
 */
export class SchemaTraitWriter {
  private readonly _shape: Shape;
  private readonly _elision: SchemaReferenceIndex;
  private readonly _stringStore: StringStore;

  public constructor(shape: Shape, elision: SchemaReferenceIndex, stringStore: StringStore) {
    this._shape = shape;
    this._elision = elision;
    this._stringStore = stringStore;
  }

  public toString(): string {
    return this._mayUseCompressedTraits() ? this._writeTraitsBitVector() : this._writeTraitsObject();
  }

  private _mayUseCompressedTraits(): boolean {
    const compressed = new Set(COMPRESS_TRAITS.map(String));
    for (const traitId of this._shape.getAllTraits().keys()) {
      if (this._elision.traits.includeTrait(traitId) && !compressed.has(traitId.toString())) {
        return false;
      }
    }
    return true;
  }

  private _writeTraitsBitVector(): string {
    let bits = 0;
    COMPRESS_TRAITS.forEach((id, i) => {
      if (this._shape.hasTrait(id)) {
        bits |= 1 << i;
      }
    });
    return String(bits);
  }

  private _writeTraitsObject(): string {
    let buffer = "{ ";
    for (const [shapeId, trait] of new TreeMap(null, this._shape.getAllTraits())) {
      if (!this._elision.traits.includeTrait(trait.toShapeId())) {
        continue;
      }
      buffer += `[${this._stringStore.var(shapeId.getName())}]: ${traitGenerator.serializeTraitData(trait, this._stringStore)}, `;
    }
    buffer = buffer.slice(0, -2);
    return buffer + " }";
  }
}
