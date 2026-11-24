import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class XmlNamespaceTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#xmlNamespace");

  private readonly _uri: string;
  private readonly _prefix: string | undefined;

  constructor(value: unknown) {
    super(XmlNamespaceTrait.ID, value);
    const object = Nodes.expectObject(value);
    this._uri = Nodes.expectString(Nodes.expectMember(object, "uri"));
    this._prefix = Nodes.getString(object, "prefix");
  }

  public getUri(): string {
    return this._uri;
  }

  public getPrefix(): string | undefined {
    return this._prefix;
  }
}
