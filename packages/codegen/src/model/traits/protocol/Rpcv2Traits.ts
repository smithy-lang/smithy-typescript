import { Nodes } from "../../node/Nodes";
import { ShapeId } from "../../shapes/ShapeId";
import { Trait } from "../Trait";

abstract class Rpcv2ProtocolTrait extends Trait {
  private readonly _http: string[];
  private readonly _eventStreamHttp: string[];

  protected constructor(id: ShapeId, value: unknown) {
    super(id, value === undefined || value === null ? {} : value);
    const object = Nodes.expectObject(this.toNode());
    this._http = Nodes.getStringArray(object, "http") ?? [];
    this._eventStreamHttp = Nodes.getStringArray(object, "eventStreamHttp") ?? [];
  }
}

export class Rpcv2CborTrait extends Rpcv2ProtocolTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.protocols#rpcv2Cbor");

  constructor(value?: unknown) {
    super(Rpcv2CborTrait.ID, value);
  }
}

export class Rpcv2JsonTrait extends Rpcv2ProtocolTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.protocols#rpcv2Json");

  constructor(value?: unknown) {
    super(Rpcv2JsonTrait.ID, value);
  }
}
