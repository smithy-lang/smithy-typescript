/**
 * Structural stand-ins for the model library types so this package compiles independently of src/model.
 */
export interface Shape {
  toString(): string;
}

export interface MemberShape extends Shape {
  getMemberName(): string;
}
