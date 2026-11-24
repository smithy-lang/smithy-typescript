import type { Model } from "../Model";
import { RequiredTrait } from "../traits/AnnotationTraits";
import type { Trait, TraitClass } from "../traits/Trait";
import { Shape } from "./Shape";
import type { ShapeInit } from "./Shape";
import type { ShapeId } from "./ShapeId";
import type { ShapeType } from "./ShapeType";
import type { ShapeVisitor } from "./ShapeVisitor";

interface MemberShapeInit extends ShapeInit {
  target: ShapeId;
  mixins?: readonly MemberShape[];
}

/**
 * A member of an aggregate shape. Its ID is the container ID plus `$memberName`.
 *
 * @internal
 */
export class MemberShape extends Shape {
  private readonly _target: ShapeId;
  private readonly _memberName: string;

  constructor(init: MemberShapeInit) {
    super(init.id, init.traits ?? [], init.mixins ?? [], true);
    this._target = init.target;
    this._memberName = init.id.getMember() ?? "";
  }

  public getType(): ShapeType {
    return "member";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.memberShape(this);
  }

  public getContainer(): ShapeId {
    return this.getId().withoutMember();
  }

  public getTarget(): ShapeId {
    return this._target;
  }

  public getMemberName(): string {
    return this._memberName;
  }

  public isRequired(): boolean {
    return this.hasTrait(RequiredTrait.ID);
  }

  public getMemberTrait<T extends Trait>(model: Model, traitClass: TraitClass<T>): T | undefined {
    const own = this.getTrait(traitClass);
    if (own !== undefined) {
      return own;
    }
    const target = model.getShape(this._target);
    return target === undefined ? undefined : target.getTrait(traitClass);
  }
}
