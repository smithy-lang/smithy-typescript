import type { Model } from "../Model";
import { Nodes } from "../node/Nodes";
import type { MemberShape } from "../shapes/MemberShape";
import type { StructureShape } from "../shapes/AggregateShapes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class PaginatedTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#paginated");

  private readonly _items: string | undefined;
  private readonly _inputToken: string | undefined;
  private readonly _outputToken: string | undefined;
  private readonly _pageSize: string | undefined;

  constructor(value: unknown) {
    super(PaginatedTrait.ID, value);
    const object = Nodes.expectObject(value);
    this._pageSize = Nodes.getString(object, "pageSize");
    this._items = Nodes.getString(object, "items");
    this._inputToken = Nodes.getString(object, "inputToken");
    this._outputToken = Nodes.getString(object, "outputToken");
  }

  public static resolveFullPath(path: string, model: Model, shape: StructureShape): MemberShape[] {
    const members: MemberShape[] = [];
    let container: StructureShape | undefined = shape;
    for (const memberName of path.split(".")) {
      const member: MemberShape | undefined = container === undefined ? undefined : container.getMember(memberName);
      if (member === undefined) {
        return [];
      }
      members.push(member);
      container = model.getShape(member.getTarget())?.asStructureShape();
    }
    return members;
  }

  public getItems(): string | undefined {
    return this._items;
  }

  public getInputToken(): string | undefined {
    return this._inputToken;
  }

  public getOutputToken(): string | undefined {
    return this._outputToken;
  }

  public getPageSize(): string | undefined {
    return this._pageSize;
  }

  public merge(other: PaginatedTrait | undefined): PaginatedTrait {
    if (other === undefined) {
      return this;
    }
    const merged: { [key: string]: string } = {};
    const inputToken = this._inputToken ?? other._inputToken;
    const outputToken = this._outputToken ?? other._outputToken;
    const pageSize = this._pageSize ?? other._pageSize;
    const items = this._items ?? other._items;
    if (inputToken !== undefined) {
      merged.inputToken = inputToken;
    }
    if (outputToken !== undefined) {
      merged.outputToken = outputToken;
    }
    if (items !== undefined) {
      merged.items = items;
    }
    if (pageSize !== undefined) {
      merged.pageSize = pageSize;
    }
    return new PaginatedTrait(merged);
  }
}
