import { InvalidPatternException } from "../exceptions/exceptions";
import { JavaStrings } from "../utils/JavaStrings";
import { Segment, SmithyPattern } from "./SmithyPattern";

/**
 * An HTTP URI pattern with labels and literal query parameters.
 *
 * @internal
 */
export class UriPattern extends SmithyPattern {
  private readonly queryLiterals: Map<string, string>;

  private constructor(pattern: string, segments: Segment[], queryLiterals: Map<string, string>) {
    super(pattern, segments);
    this.queryLiterals = queryLiterals;
  }

  public static parse(uri: string): UriPattern {
    if (uri.endsWith("?")) {
      throw new InvalidPatternException("URI patterns must not end with '?'. Found " + uri);
    } else if (!uri.startsWith("/")) {
      throw new InvalidPatternException("URI pattern must start with '/'. Found " + uri);
    } else if (uri.indexOf("#") !== -1) {
      throw new InvalidPatternException("URI pattern must not contain a fragment. Found " + uri);
    }
    const parts = JavaStrings.split(uri, "?", 2);
    const unparsedSegments = JavaStrings.split(parts[0], "/");
    const segments: Segment[] = [];
    let offset = 1;
    for (let i = 1; i < unparsedSegments.length; i++) {
      const segment = unparsedSegments[i];
      segments.push(Segment.parse(segment, offset));
      offset += segment.length + 1;
    }
    const queryLiterals = new Map<string, string>();
    if (parts.length === 2) {
      if (parts[1].indexOf("{") !== -1 || parts[1].indexOf("}") !== -1) {
        throw new InvalidPatternException("URI labels must not appear in the query string. Found " + uri);
      }
      for (const kvp of JavaStrings.split(parts[1], "&")) {
        const parameterParts = JavaStrings.split(kvp, "=", 2);
        const actualKey = parameterParts[0];
        if (queryLiterals.has(actualKey)) {
          throw new InvalidPatternException("Literal query parameters must not be repeated: " + uri);
        }
        queryLiterals.set(actualKey, parameterParts.length === 2 ? parameterParts[1] : "");
      }
    }
    return new UriPattern(uri, segments, queryLiterals);
  }

  public equals(other: unknown): boolean {
    return (
      other instanceof UriPattern &&
      super.equals(other) &&
      UriPattern._mapsEqual(this.queryLiterals, other.queryLiterals)
    );
  }

  private static _mapsEqual(left: Map<string, string>, right: Map<string, string>): boolean {
    if (left.size !== right.size) {
      return false;
    }
    for (const [key, value] of left) {
      if (right.get(key) !== value) {
        return false;
      }
    }
    return true;
  }
}
