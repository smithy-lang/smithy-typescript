import { InvalidPatternException } from "../exceptions/exceptions";
import { Nodes } from "../node/Nodes";
import { Segment, SmithyPattern } from "../pattern/SmithyPattern";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class EndpointTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#endpoint");

  private readonly _hostPrefix: SmithyPattern;

  constructor(value: unknown) {
    super(EndpointTrait.ID, value);
    const object = Nodes.expectObject(value);
    this._hostPrefix = EndpointTrait._parseHostPrefix(Nodes.expectString(Nodes.expectMember(object, "hostPrefix")));
  }

  public getHostPrefix(): SmithyPattern {
    return this._hostPrefix;
  }

  private static _parseHostPrefix(hostPrefix: string): SmithyPattern {
    const tokens = EndpointTrait._tokenize(hostPrefix);
    const segments: Segment[] = [];
    let position = 0;
    let index = 0;
    while (index < tokens.length) {
      let token = tokens[index++];
      if (token === "{") {
        if (segments.length > 0 && segments[segments.length - 1].isLabel()) {
          throw new InvalidPatternException("Host labels must not be adjacent in a pattern. Found " + hostPrefix);
        }
        for (let i = 0; i < 2; i++) {
          if (index < tokens.length) {
            token += tokens[index++];
          } else {
            throw new InvalidPatternException("Unclosed label found in pattern at: ." + position);
          }
        }
      } else if (token === "}") {
        throw new InvalidPatternException("Literal segments must not contain `}`. Found at: " + position);
      }
      segments.push(Segment.parse(token, position));
      position += token.length;
    }
    return new SmithyPattern(hostPrefix, segments, false);
  }

  /**
   * Splits on braces and keeps them as tokens, like java.util.StringTokenizer with returnDelims.
   */
  private static _tokenize(text: string): string[] {
    const tokens: string[] = [];
    let current = "";
    for (let i = 0; i < text.length; i++) {
      const c = text.charAt(i);
      if (c === "{" || c === "}") {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
        tokens.push(c);
      } else {
        current += c;
      }
    }
    if (current.length > 0) {
      tokens.push(current);
    }
    return tokens;
  }
}
