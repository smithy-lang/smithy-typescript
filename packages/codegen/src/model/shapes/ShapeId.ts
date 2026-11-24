import { ShapeIdSyntaxException } from "../exceptions/exceptions";
import { JavaStrings } from "../utils/JavaStrings";

const PRELUDE_NAMESPACE = "smithy.api";
const CACHE = new Map<string, ShapeId>();

/**
 * Anything that can be resolved to a shape ID.
 *
 * @internal
 */
export interface ToShapeId {
  toShapeId(): ShapeId;
}

/**
 * An absolute shape ID such as `ns#Name` or `ns#Name$member`.
 *
 * Instances are interned by their string form, so reference equality matches `equals`.
 *
 * @internal
 */
export class ShapeId implements ToShapeId {
  private readonly namespace: string;
  private readonly name: string;
  private readonly member: string | undefined;
  private readonly absoluteName: string;
  private hash = 0;

  private constructor(absoluteName: string, namespace: string, name: string, member: string | undefined) {
    this.absoluteName = absoluteName;
    this.namespace = namespace;
    this.name = name;
    this.member = member;
  }

  public static from(id: string): ShapeId {
    const cached = CACHE.get(id);
    if (cached !== undefined) {
      return cached;
    }
    return ShapeId._parse(id);
  }

  public static fromParts(namespace: string, name: string, member?: string): ShapeId {
    const absolute = ShapeId._buildAbsoluteId(namespace, name, member);
    const cached = CACHE.get(absolute);
    if (cached !== undefined) {
      return cached;
    }
    ShapeId._validateParts(namespace, name, member);
    return ShapeId._intern(absolute, namespace, name, member);
  }

  public static isValidNamespace(namespace: string | null | undefined): boolean {
    if (namespace === null || namespace === undefined) {
      return false;
    }
    if (namespace === PRELUDE_NAMESPACE) {
      return true;
    }
    const length = namespace.length;
    if (length === 0) {
      return false;
    }
    let position = 0;
    while (true) {
      position = ShapeId._parseIdentifier(namespace, position);
      if (position === -1) {
        return false;
      } else if (position === length) {
        return true;
      } else if (namespace.charAt(position) !== ".") {
        return false;
      } else if (++position >= length) {
        return false;
      }
    }
  }

  public static isValidIdentifier(identifier: string): boolean {
    return ShapeId._parseIdentifier(identifier, 0) === identifier.length;
  }

  public toShapeId(): ShapeId {
    return this;
  }

  public getNamespace(): string {
    return this.namespace;
  }

  public getName(): string {
    return this.name;
  }

  public getMember(): string | undefined {
    return this.member;
  }

  public hasMember(): boolean {
    return this.member !== undefined;
  }

  public withMember(member: string): ShapeId {
    if (!ShapeId.isValidIdentifier(member)) {
      throw new ShapeIdSyntaxException("Invalid shape ID member: " + member);
    }
    return ShapeId.fromParts(this.namespace, this.name, member);
  }

  public withoutMember(): ShapeId {
    return this.member === undefined ? this : ShapeId.fromParts(this.namespace, this.name);
  }

  public compareTo(other: ShapeId): number {
    const outcome = JavaStrings.compareToIgnoreCase(this.absoluteName, other.absoluteName);
    return outcome === 0 ? JavaStrings.compare(this.absoluteName, other.absoluteName) : outcome;
  }

  public equals(other: unknown): boolean {
    return this === other;
  }

  public toString(): string {
    return this.absoluteName;
  }

  private static _intern(absolute: string, namespace: string, name: string, member: string | undefined): ShapeId {
    const id = new ShapeId(absolute, namespace, name, member);
    CACHE.set(absolute, id);
    return id;
  }

  private static _parse(absoluteShapeId: string): ShapeId {
    const namespacePosition = absoluteShapeId.indexOf("#");
    if (namespacePosition <= 0 || namespacePosition === absoluteShapeId.length - 1) {
      throw new ShapeIdSyntaxException("Invalid shape ID: " + absoluteShapeId);
    }
    const namespace = absoluteShapeId.substring(0, namespacePosition);
    const memberPosition = absoluteShapeId.indexOf("$");
    let name: string;
    let member: string | undefined;
    if (memberPosition === -1) {
      name = absoluteShapeId.substring(namespacePosition + 1);
    } else if (memberPosition < namespacePosition) {
      throw new ShapeIdSyntaxException("Invalid shape ID: " + absoluteShapeId);
    } else {
      name = absoluteShapeId.substring(namespacePosition + 1, memberPosition);
      member = absoluteShapeId.substring(memberPosition + 1);
    }
    ShapeId._validateParts(namespace, name, member);
    return ShapeId._intern(absoluteShapeId, namespace, name, member);
  }

  private static _validateParts(namespace: string, name: string, member: string | undefined): void {
    if (
      !ShapeId.isValidNamespace(namespace) ||
      !ShapeId.isValidIdentifier(name) ||
      (member !== undefined && !ShapeId.isValidIdentifier(member))
    ) {
      throw new ShapeIdSyntaxException("Invalid shape ID: " + ShapeId._buildAbsoluteId(namespace, name, member));
    }
  }

  private static _buildAbsoluteId(namespace: string, name: string, member: string | undefined): string {
    return member !== undefined ? namespace + "#" + name + "$" + member : namespace + "#" + name;
  }

  private static _parseIdentifier(identifier: string, start: number): number {
    let offset = start;
    if (identifier.length <= offset) {
      return -1;
    }
    const startingChar = identifier.charAt(offset);
    if (startingChar === "_") {
      while (offset < identifier.length && identifier.charAt(offset) === "_") {
        offset++;
      }
      if (offset === identifier.length) {
        return -1;
      }
      const current = identifier.charAt(offset);
      if (!ShapeId._isAlphabetic(current) && !ShapeId._isDigit(current)) {
        return -1;
      }
      offset++;
    } else if (!ShapeId._isAlphabetic(startingChar)) {
      return -1;
    }
    while (offset < identifier.length) {
      const c = identifier.charAt(offset);
      if (c !== "_" && !ShapeId._isAlphabetic(c) && !ShapeId._isDigit(c)) {
        return offset;
      }
      offset++;
    }
    return offset;
  }

  private static _isAlphabetic(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
  }

  private static _isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }
}
