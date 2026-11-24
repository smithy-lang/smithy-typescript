import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

export class AuthTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#auth");

  private readonly _values: ShapeId[];

  constructor(value: unknown) {
    super(AuthTrait.ID, value);
    const seen = new Set<ShapeId>();
    for (const entry of Nodes.expectArray(value)) {
      seen.add(Nodes.expectShapeId(entry));
    }
    this._values = Array.from(seen);
  }

  public getValueSet(): readonly ShapeId[] {
    return this._values;
  }
}

/**
 * @internal
 */
export class AuthDefinitionTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#authDefinition");

  private readonly _traits: ShapeId[];

  constructor(value?: unknown) {
    super(AuthDefinitionTrait.ID, value === undefined || value === null ? {} : value);
    this._traits = (Nodes.getArray(Nodes.expectObject(this.toNode()), "traits") ?? []).map((entry) =>
      Nodes.expectShapeId(entry)
    );
  }
}

/**
 * @internal
 */
export class ProtocolDefinitionTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#protocolDefinition");

  private readonly _traits: ShapeId[];
  private readonly _noInlineDocumentSupport: boolean;

  constructor(value?: unknown) {
    super(ProtocolDefinitionTrait.ID, value === undefined || value === null ? {} : value);
    const object = Nodes.expectObject(this.toNode());
    this._traits = (Nodes.getArray(object, "traits") ?? []).map((entry) => Nodes.expectShapeId(entry));
    this._noInlineDocumentSupport = Nodes.getBooleanOrDefault(object, "noInlineDocumentSupport");
  }

  public getTraits(): ShapeId[] {
    return this._traits;
  }
}
