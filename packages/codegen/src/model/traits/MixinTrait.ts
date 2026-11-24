import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

export class MixinTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#mixin");

  private readonly _localTraits: ShapeId[];

  constructor(value?: unknown) {
    super(MixinTrait.ID, value === undefined || value === null ? {} : value);
    const local: ShapeId[] = [];
    const object = Nodes.expectObject(value === undefined || value === null ? {} : value);
    const declared = Nodes.getArray(object, "localTraits");
    if (declared !== undefined) {
      for (const entry of declared) {
        local.push(Nodes.expectShapeId(entry));
      }
    }
    if (local.indexOf(MixinTrait.ID) === -1) {
      local.push(MixinTrait.ID);
    }
    this._localTraits = local;
  }

  /**
   * Removes the traits a mixin declares as local so they are not inherited by shapes that use it.
   */
  public static getNonLocalTraitsFromMap(traits: ReadonlyMap<ShapeId, Trait>): ReadonlyMap<ShapeId, Trait> {
    const mixin = traits.get(MixinTrait.ID);
    if (mixin === undefined) {
      return traits;
    }
    const filtered = new Map<ShapeId, Trait>(traits);
    for (const local of (mixin as MixinTrait).getLocalTraits()) {
      filtered.delete(local);
    }
    return filtered;
  }

  public getLocalTraits(): readonly ShapeId[] {
    return this._localTraits;
  }
}
