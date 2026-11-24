import type { MemberShape } from "../shapes/MemberShape";
import type { Trait } from "../traits/Trait";

/**
 * @internal
 */
export type HttpBindingLocation =
  | "LABEL"
  | "DOCUMENT"
  | "PAYLOAD"
  | "HEADER"
  | "PREFIX_HEADERS"
  | "QUERY"
  | "QUERY_PARAMS"
  | "RESPONSE_CODE"
  | "UNBOUND";

/**
 * Binds a structure member to a location in an HTTP message.
 *
 * @internal
 */
export class HttpBinding {
  private readonly _member: MemberShape;
  private readonly _location: HttpBindingLocation;
  private readonly _locationName: string;
  private readonly _bindingTrait: Trait | undefined;

  constructor(
    member: MemberShape,
    location: HttpBindingLocation,
    locationName: string,
    bindingTrait: Trait | undefined
  ) {
    this._member = member;
    this._location = location;
    this._locationName = locationName;
    this._bindingTrait = bindingTrait;
  }

  public getMember(): MemberShape {
    return this._member;
  }

  public getMemberName(): string {
    return this._member.getMemberName();
  }

  public getLocation(): HttpBindingLocation {
    return this._location;
  }

  public equals(other: unknown): boolean {
    return (
      other instanceof HttpBinding &&
      this._member === other._member &&
      this._location === other._location &&
      this._locationName === other._locationName
    );
  }

  public toString(): string {
    return this._member.getId() + " @ " + this._location.toLowerCase() + " (" + this._locationName + ")";
  }
}
