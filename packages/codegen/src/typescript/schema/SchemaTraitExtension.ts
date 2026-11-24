import type { ShapeId, Trait } from "../../model";

type TraitRenderer = (trait: Trait) => string;

/**
 * Registry of traits that integrations add to rendered schemas.
 */
export class SchemaTraitExtension {
  public static readonly INSTANCE = new SchemaTraitExtension();

  private readonly _customization = new Map<string, TraitRenderer>();

  private constructor() {}

  public render(trait: Trait): string {
    return this._customization.get(trait.toShapeId().toString())!(trait);
  }

  public contains(trait: Trait | ShapeId): boolean {
    const id = "toShapeId" in trait ? trait.toShapeId() : trait;
    return this._customization.has(id.toString());
  }
}
