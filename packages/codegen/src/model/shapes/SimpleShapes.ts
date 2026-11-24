import { SourceException } from "../exceptions/exceptions";
import { InternalTrait } from "../traits/AnnotationTraits";
import { DocumentationTrait } from "../traits/StringTraits";
import { DeprecatedTrait } from "../traits/DeprecatedTrait";
import { EnumDefinition, EnumTrait, EnumValueTrait, SyntheticEnumTrait } from "../traits/EnumTrait";
import { TagsTrait } from "../traits/TagsTrait";
import type { Trait } from "../traits/Trait";
import type { MemberShape } from "./MemberShape";
import { NamedMemberUtils } from "./NamedMemberUtils";
import { Shape } from "./Shape";
import type { ShapeInit } from "./Shape";
import type { ShapeId } from "./ShapeId";
import type { ShapeType } from "./ShapeType";
import type { ShapeVisitor } from "./ShapeVisitor";

interface NamedMembersShapeInit extends ShapeInit {
  members?: readonly MemberShape[];
}

abstract class SimpleShape extends Shape {
  protected constructor(init: ShapeInit) {
    super(init.id, init.traits ?? [], init.mixins ?? [], false);
  }
}

abstract class NumberShape extends SimpleShape {}

/**
 * @internal
 */
export class BlobShape extends SimpleShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "blob";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.blobShape(this);
  }
}

/**
 * @internal
 */
export class BooleanShape extends SimpleShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "boolean";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.booleanShape(this);
  }
}

/**
 * @internal
 */
export class TimestampShape extends SimpleShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "timestamp";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.timestampShape(this);
  }
}

/**
 * @internal
 */
export class DocumentShape extends SimpleShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "document";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.documentShape(this);
  }
}

/**
 * @internal
 */
export class ByteShape extends NumberShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "byte";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.byteShape(this);
  }
}

/**
 * @internal
 */
export class ShortShape extends NumberShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "short";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.shortShape(this);
  }
}

/**
 * @internal
 */
export class LongShape extends NumberShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "long";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.longShape(this);
  }
}

/**
 * @internal
 */
export class FloatShape extends NumberShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "float";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.floatShape(this);
  }
}

/**
 * @internal
 */
export class DoubleShape extends NumberShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "double";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.doubleShape(this);
  }
}

/**
 * @internal
 */
export class BigIntegerShape extends NumberShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "bigInteger";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.bigIntegerShape(this);
  }
}

/**
 * @internal
 */
export class BigDecimalShape extends NumberShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "bigDecimal";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.bigDecimalShape(this);
  }
}

/**
 * @internal
 */
export class IntegerShape extends NumberShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "integer";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.integerShape(this);
  }
}

/**
 * @internal
 */
export class StringShape extends SimpleShape {
  constructor(init: ShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "string";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.stringShape(this);
  }
}

/**
 * A string shape with named members. Its `@enum` trait is synthesized from the members.
 *
 * @internal
 */
export class EnumShape extends StringShape {
  private readonly _members: Map<string, MemberShape>;
  private _enumValues: Map<string, string> | undefined;

  constructor(init: NamedMembersShapeInit) {
    const members = NamedMemberUtils.computeMixinMembers(init.mixins ?? [], init.members ?? [], init.id);
    if (members.size < 1) {
      throw new SourceException("enum shapes must have at least one member");
    }
    super({ id: init.id, traits: EnumShape._withSyntheticTrait(init.traits ?? [], members), mixins: init.mixins });
    this._members = members;
  }

  public getType(): ShapeType {
    return "enum";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.enumShape(this);
  }

  public getEnumValues(): ReadonlyMap<string, string> {
    if (this._enumValues === undefined) {
      const values = new Map<string, string>();
      for (const member of this._members.values()) {
        values.set(member.getMemberName(), member.expectTrait(EnumValueTrait).expectStringValue());
      }
      this._enumValues = values;
    }
    return this._enumValues;
  }

  public getAllMembers(): ReadonlyMap<string, MemberShape> {
    return this._members;
  }

  protected _lookupTrait(id: ShapeId): Trait | undefined {
    return super._lookupTrait(id.equals(EnumTrait.ID) ? SyntheticEnumTrait.ID : id);
  }

  private static _withSyntheticTrait(traits: readonly Trait[], members: ReadonlyMap<string, MemberShape>): Trait[] {
    const definitions: unknown[] = [];
    for (const member of members.values()) {
      const definition = EnumShape._definitionFromMember(member);
      if (definition === undefined) {
        return traits.slice();
      }
      definitions.push(definition.toNode());
    }
    return traits.concat([new SyntheticEnumTrait(definitions)]);
  }

  private static _definitionFromMember(member: MemberShape): EnumDefinition | undefined {
    const enumValue = member.getTrait(EnumValueTrait);
    const value = enumValue === undefined ? undefined : enumValue.getStringValue();
    if (value === undefined) {
      return undefined;
    }
    const documentation = member.getTrait(DocumentationTrait);
    const tags = member.getTrait(TagsTrait);
    const tagValues = tags === undefined ? [] : tags.getValues().slice();
    if (member.hasTrait(InternalTrait.ID) && tagValues.indexOf("internal") === -1) {
      tagValues.push("internal");
    }
    return new EnumDefinition(
      value,
      member.getMemberName(),
      documentation === undefined ? undefined : documentation.getValue(),
      tagValues,
      member.hasTrait(DeprecatedTrait.ID)
    );
  }
}

/**
 * An integer shape with named members. Members carry integer `enumValue` traits.
 *
 * @internal
 */
export class IntEnumShape extends IntegerShape {
  private readonly _members: Map<string, MemberShape>;
  private _enumValues: Map<string, number> | undefined;

  constructor(init: NamedMembersShapeInit) {
    const members = NamedMemberUtils.computeMixinMembers(init.mixins ?? [], init.members ?? [], init.id);
    if (members.size < 1) {
      throw new SourceException("intEnum shapes must have at least one member");
    }
    super(init);
    this._members = members;
  }

  public getType(): ShapeType {
    return "intEnum";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.intEnumShape(this);
  }

  public getEnumValues(): ReadonlyMap<string, number> {
    if (this._enumValues === undefined) {
      const values = new Map<string, number>();
      for (const member of this._members.values()) {
        values.set(member.getMemberName(), member.expectTrait(EnumValueTrait).expectIntValue());
      }
      this._enumValues = values;
    }
    return this._enumValues;
  }

  public getAllMembers(): ReadonlyMap<string, MemberShape> {
    return this._members;
  }
}
