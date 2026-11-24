import { ExpectationNotMetException } from "../exceptions/exceptions";
import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

type HttpApiKeyLocation = "header" | "query";

/**
 * @internal
 */
export class HttpApiKeyAuthTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpApiKeyAuth");

  private readonly _name: string;
  private readonly _in: HttpApiKeyLocation;
  private readonly _scheme: string | undefined;

  constructor(value: unknown) {
    super(HttpApiKeyAuthTrait.ID, value);
    const object = Nodes.expectObject(value);
    this._name = Nodes.expectString(Nodes.expectMember(object, "name"));
    const location = Nodes.expectString(Nodes.expectMember(object, "in"));
    if (location !== "header" && location !== "query") {
      throw new ExpectationNotMetException("Invalid location type: " + location);
    }
    this._in = location;
    this._scheme = Nodes.getString(object, "scheme");
  }

  public getName(): string {
    return this._name;
  }

  public getIn(): HttpApiKeyLocation {
    return this._in;
  }

  public getScheme(): string | undefined {
    return this._scheme;
  }
}
