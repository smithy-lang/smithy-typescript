import { ExpectationNotMetException, SourceException } from "../exceptions/exceptions";
import type { Model } from "../Model";
import { MixinTrait } from "../traits/MixinTrait";
import { TagsTrait } from "../traits/TagsTrait";
import { isTraitClass, makeAbsoluteTraitName } from "../traits/Trait";
import type { Trait, TraitClass } from "../traits/Trait";
import type { ListShape, MapShape, SetShape, StructureShape, UnionShape } from "./AggregateShapes";
import type { MemberShape } from "./MemberShape";
import type { OperationShape, ResourceShape, ServiceShape } from "./ServiceShapes";
import { ShapeId } from "./ShapeId";
import type { ToShapeId } from "./ShapeId";
import type { ShapeType } from "./ShapeType";
import type { ShapeVisitor } from "./ShapeVisitor";

/**
 * @internal
 */
export interface ShapeInit {
  id: ShapeId;
  traits?: readonly Trait[];
  mixins?: readonly Shape[];
}

const EMPTY_MEMBERS: ReadonlyMap<string, MemberShape> = new Map<string, MemberShape>();

/**
 * Base class of all shapes.
 *
 * @internal
 */
export abstract class Shape implements ToShapeId {
  private readonly _id: ShapeId;
  private readonly _traits: Map<ShapeId, Trait>;
  private readonly _introducedTraits: Map<ShapeId, Trait>;
  private readonly _mixins: Map<ShapeId, Shape>;

  protected constructor(
    id: ShapeId,
    introducedTraits: readonly Trait[],
    mixins: readonly Shape[],
    expectMember: boolean
  ) {
    this._id = id;
    this._introducedTraits = new Map<ShapeId, Trait>();
    for (const trait of introducedTraits) {
      this._introducedTraits.set(trait.toShapeId(), trait);
    }
    this._mixins = new Map<ShapeId, Shape>();
    for (const mixin of mixins) {
      this._mixins.set(mixin.getId(), mixin);
    }
    this._validateShapeId(expectMember);
    if (this._mixins.size === 0) {
      this._traits = this._introducedTraits;
    } else {
      this._validateMixins();
      const computed = new Map<ShapeId, Trait>();
      for (const mixin of this._mixins.values()) {
        for (const [traitId, trait] of MixinTrait.getNonLocalTraitsFromMap(mixin.getAllTraits())) {
          computed.set(traitId, trait);
        }
      }
      for (const [traitId, trait] of this._introducedTraits) {
        computed.set(traitId, trait);
      }
      this._traits = computed;
    }
  }

  public abstract getType(): ShapeType;

  public abstract accept<R>(visitor: ShapeVisitor<R>): R;

  public getId(): ShapeId {
    return this._id;
  }

  public toShapeId(): ShapeId {
    return this._id;
  }

  public hasTrait(trait: string | ShapeId | TraitClass<Trait>): boolean {
    if (isTraitClass(trait)) {
      return this.getTrait(trait) !== undefined;
    }
    return this.findTrait(trait) !== undefined;
  }

  public findTrait(id: string | ShapeId): Trait | undefined {
    return this._lookupTrait(typeof id === "string" ? ShapeId.from(makeAbsoluteTraitName(id)) : id);
  }

  public getTrait<T extends Trait>(traitClass: TraitClass<T>): T | undefined {
    const trait = this._lookupTrait(traitClass.ID);
    if (trait !== undefined) {
      return trait as T;
    }
    const aliases = traitClass.ALIASES;
    if (aliases !== undefined) {
      for (const alias of aliases) {
        const aliased = this._traits.get(alias);
        if (aliased !== undefined) {
          return aliased as T;
        }
      }
    }
    return undefined;
  }

  public expectTrait<T extends Trait>(traitClass: TraitClass<T>): T {
    const trait = this.getTrait(traitClass);
    if (trait === undefined) {
      throw new ExpectationNotMetException("Expected shape `" + this._id + "` to have a trait `" + traitClass.ID + "`");
    }
    return trait;
  }

  public getAllTraits(): ReadonlyMap<ShapeId, Trait> {
    return this._traits;
  }

  public getIntroducedTraits(): ReadonlyMap<ShapeId, Trait> {
    return this._introducedTraits;
  }

  public getMemberTrait<T extends Trait>(_model: Model, traitClass: TraitClass<T>): T | undefined {
    return this.getTrait(traitClass);
  }

  public getTags(): string[] {
    const tags = this.getTrait(TagsTrait);
    return tags === undefined ? [] : tags.getValues();
  }

  public members(): MemberShape[] {
    return Array.from(this.getAllMembers().values());
  }

  public getMember(name: string): MemberShape | undefined {
    return this.getAllMembers().get(name);
  }

  public getAllMembers(): ReadonlyMap<string, MemberShape> {
    return EMPTY_MEMBERS;
  }

  public getMixins(): ShapeId[] {
    return Array.from(this._mixins.keys());
  }

  /**
   * Drops the mixin references after their members and traits were copied onto this shape.
   */
  public clearMixins(): void {
    this._mixins.clear();
  }

  public asListShape(): ListShape | undefined {
    return this._asType<ListShape>("list");
  }

  public asSetShape(): SetShape | undefined {
    return this._asType<SetShape>("set");
  }

  public asMapShape(): MapShape | undefined {
    return this._asType<MapShape>("map");
  }

  public asMemberShape(): MemberShape | undefined {
    return this._asType<MemberShape>("member");
  }

  public asOperationShape(): OperationShape | undefined {
    return this._asType<OperationShape>("operation");
  }

  public asResourceShape(): ResourceShape | undefined {
    return this._asType<ResourceShape>("resource");
  }

  public asServiceShape(): ServiceShape | undefined {
    return this._asType<ServiceShape>("service");
  }

  public asStructureShape(): StructureShape | undefined {
    return this._asType<StructureShape>("structure");
  }

  public asUnionShape(): UnionShape | undefined {
    return this._asType<UnionShape>("union");
  }

  public isBigDecimalShape(): boolean {
    return this.getType() === "bigDecimal";
  }

  public isBigIntegerShape(): boolean {
    return this.getType() === "bigInteger";
  }

  public isBlobShape(): boolean {
    return this.getType() === "blob";
  }

  public isFloatShape(): boolean {
    return this.getType() === "float";
  }

  public isDocumentShape(): boolean {
    return this.getType() === "document";
  }

  public isDoubleShape(): boolean {
    return this.getType() === "double";
  }

  public isListShape(): boolean {
    return this.getType() === "list";
  }

  public isSetShape(): boolean {
    return this.getType() === "set";
  }

  public isIntEnumShape(): boolean {
    return this.getType() === "intEnum";
  }

  public isMapShape(): boolean {
    return this.getType() === "map";
  }

  public isMemberShape(): boolean {
    return this.getType() === "member";
  }

  public isOperationShape(): boolean {
    return this.getType() === "operation";
  }

  public isResourceShape(): boolean {
    return this.getType() === "resource";
  }

  public isServiceShape(): boolean {
    return this.getType() === "service";
  }

  public isEnumShape(): boolean {
    return this.getType() === "enum";
  }

  public isStructureShape(): boolean {
    return this.getType() === "structure";
  }

  public isUnionShape(): boolean {
    return this.getType() === "union";
  }

  public isTimestampShape(): boolean {
    return this.getType() === "timestamp";
  }

  public compareTo(other: Shape): number {
    return this._id.compareTo(other._id);
  }

  public equals(other: unknown): boolean {
    return this === other;
  }

  public toString(): string {
    return "(" + this.getType() + ": `" + this._id + "`)";
  }

  protected _lookupTrait(id: ShapeId): Trait | undefined {
    return this._traits.get(id);
  }

  private _asType<T>(type: ShapeType): T | undefined {
    return this.getType() === type ? (this as unknown as T) : undefined;
  }

  private _validateShapeId(expectMember: boolean): void {
    if (expectMember) {
      if (!this._id.hasMember()) {
        throw new SourceException(
          "Shapes of type `" + this.getType() + "` must contain a member in their shape ID. Found `" + this._id + "`"
        );
      }
    } else if (this._id.hasMember()) {
      throw new SourceException(
        "Shapes of type `" + this.getType() + "` cannot contain a member in their shape ID. Found `" + this._id + "`"
      );
    }
  }

  private _validateMixins(): void {
    const invalid: string[] = [];
    for (const mixin of this._mixins.values()) {
      if (mixin.getType() !== this.getType()) {
        invalid.push(mixin.getId().toString());
      }
    }
    if (invalid.length > 0) {
      invalid.sort();
      throw new SourceException(
        "Mixins may only be mixed into shapes of the same type. The following mixins were applied to the " +
          this.getType() +
          " shape `" +
          this._id +
          "` which are not " +
          this.getType() +
          " shapes: [`" +
          invalid.join("`, `") +
          "`]"
      );
    }
  }
}
