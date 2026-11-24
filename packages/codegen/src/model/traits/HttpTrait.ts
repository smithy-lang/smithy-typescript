import { Nodes } from "../node/Nodes";
import { UriPattern } from "../pattern/UriPattern";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class HttpTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#http");

  private readonly _method: string;
  private readonly _uri: UriPattern;
  private readonly _code: number;

  constructor(value: unknown) {
    super(HttpTrait.ID, value);
    const object = Nodes.expectObject(value);
    this._uri = UriPattern.parse(Nodes.expectString(Nodes.expectMember(object, "uri")));
    this._method = Nodes.expectString(Nodes.expectMember(object, "method"));
    this._code = Nodes.getNumber(object, "code") ?? 200;
  }

  public getUri(): UriPattern {
    return this._uri;
  }

  public getMethod(): string {
    return this._method;
  }

  public getCode(): number {
    return this._code;
  }
}
