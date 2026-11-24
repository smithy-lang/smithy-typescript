import { NamedMemberUtils } from "./NamedMemberUtils";
import type { MemberShape } from "./MemberShape";
import { Shape } from "./Shape";
import type { ShapeInit } from "./Shape";
import type { ShapeType } from "./ShapeType";
import type { ShapeVisitor } from "./ShapeVisitor";

interface AggregateShapeInit extends ShapeInit {
  members?: readonly MemberShape[];
}

/**
 * A shape with a single `member`, the base of list and set shapes.
 *
 * @internal
 */
export abstract class CollectionShape extends Shape {
  private readonly _member: MemberShape;
  private readonly _memberMap: Map<string, MemberShape>;

  protected constructor(init: AggregateShapeInit) {
    super(init.id, init.traits ?? [], init.mixins ?? [], false);
    this._member = NamedMemberUtils.getRequiredMember("member", init.members ?? [], init.mixins ?? [], init.id);
    this._memberMap = new Map<string, MemberShape>([["member", this._member]]);
  }

  public getMember(): MemberShape;
  public getMember(name: string): MemberShape | undefined;
  public getMember(name?: string): MemberShape | undefined {
    if (name === undefined || name === "member") {
      return this._member;
    }
    return undefined;
  }

  public getAllMembers(): ReadonlyMap<string, MemberShape> {
    return this._memberMap;
  }
}

/**
 * @internal
 */
export class ListShape extends CollectionShape {
  constructor(init: AggregateShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "list";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.listShape(this);
  }
}

/**
 * @internal
 */
export class SetShape extends CollectionShape {
  constructor(init: AggregateShapeInit) {
    super(init);
  }

  public getType(): ShapeType {
    return "set";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.setShape(this);
  }
}

/**
 * @internal
 */
export class MapShape extends Shape {
  private readonly _key: MemberShape;
  private readonly _value: MemberShape;
  private readonly _memberMap: Map<string, MemberShape>;

  constructor(init: AggregateShapeInit) {
    super(init.id, init.traits ?? [], init.mixins ?? [], false);
    this._key = NamedMemberUtils.getRequiredMember("key", init.members ?? [], init.mixins ?? [], init.id);
    this._value = NamedMemberUtils.getRequiredMember("value", init.members ?? [], init.mixins ?? [], init.id);
    this._memberMap = new Map<string, MemberShape>([
      ["key", this._key],
      ["value", this._value],
    ]);
  }

  public getType(): ShapeType {
    return "map";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.mapShape(this);
  }

  public getKey(): MemberShape {
    return this._key;
  }

  public getValue(): MemberShape {
    return this._value;
  }

  public getAllMembers(): ReadonlyMap<string, MemberShape> {
    return this._memberMap;
  }
}

/**
 * @internal
 */
export class StructureShape extends Shape {
  private readonly _members: Map<string, MemberShape>;

  constructor(init: AggregateShapeInit) {
    super(init.id, init.traits ?? [], init.mixins ?? [], false);
    this._members = NamedMemberUtils.computeMixinMembers(init.mixins ?? [], init.members ?? [], init.id);
  }

  public getType(): ShapeType {
    return "structure";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.structureShape(this);
  }

  public getAllMembers(): ReadonlyMap<string, MemberShape> {
    return this._members;
  }
}

/**
 * @internal
 */
export class UnionShape extends Shape {
  private readonly _members: Map<string, MemberShape>;

  constructor(init: AggregateShapeInit) {
    super(init.id, init.traits ?? [], init.mixins ?? [], false);
    this._members = NamedMemberUtils.computeMixinMembers(init.mixins ?? [], init.members ?? [], init.id);
  }

  public getType(): ShapeType {
    return "union";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.unionShape(this);
  }

  public getAllMembers(): ReadonlyMap<string, MemberShape> {
    return this._members;
  }
}
