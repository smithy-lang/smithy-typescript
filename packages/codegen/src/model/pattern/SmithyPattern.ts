import { InvalidPatternException } from "../exceptions/exceptions";
import { ShapeId } from "../shapes/ShapeId";

type SegmentType = "LITERAL" | "LABEL" | "GREEDY_LABEL";

/**
 * A path or host pattern made of literal and label segments.
 */
export class SmithyPattern {
  private readonly pattern: string;
  private readonly segments: Segment[];

  constructor(pattern: string, segments: Segment[], allowsGreedyLabels = true) {
    this.pattern = pattern;
    this.segments = segments;
    this._checkForDuplicateLabels();
    if (!allowsGreedyLabels && segments.some((segment) => segment.isGreedyLabel())) {
      throw new InvalidPatternException("Pattern must not contain a greedy label. Found " + pattern);
    }
  }

  public equals(other: unknown): boolean {
    return other instanceof SmithyPattern && this.pattern === other.pattern;
  }

  public toString(): string {
    return this.pattern;
  }

  private _checkForDuplicateLabels(): void {
    const labels = new Set<string>();
    for (const segment of this.segments) {
      if (segment.isLabel()) {
        const key = segment.getContent().toLowerCase();
        if (labels.has(key)) {
          throw new InvalidPatternException(
            "Label `" + segment.getContent() + "` is defined more than once in pattern: " + this.pattern
          );
        }
        labels.add(key);
      }
    }
  }
}

/**
 * One segment of a {@link SmithyPattern}.
 */
export class Segment {
  private readonly asString: string;
  private readonly content: string;
  private readonly segmentType: SegmentType;

  constructor(content: string, segmentType: SegmentType, offset?: number) {
    this.content = content;
    this.segmentType = segmentType;
    this._checkForInvalidContents(offset);
    if (segmentType === "GREEDY_LABEL") {
      this.asString = "{" + content + "+}";
    } else if (segmentType === "LABEL") {
      this.asString = "{" + content + "}";
    } else {
      this.asString = content;
    }
  }

  public static parse(content: string, offset: number): Segment {
    if (content.length >= 2 && content.charAt(0) === "{" && content.charAt(content.length - 1) === "}") {
      const greedy = content.charAt(content.length - 2) === "+";
      const inner = greedy ? content.substring(1, content.length - 2) : content.substring(1, content.length - 1);
      return new Segment(inner, greedy ? "GREEDY_LABEL" : "LABEL", offset);
    }
    return new Segment(content, "LITERAL", offset);
  }

  public getContent(): string {
    return this.content;
  }

  public isLabel(): boolean {
    return this.segmentType !== "LITERAL";
  }

  public isGreedyLabel(): boolean {
    return this.segmentType === "GREEDY_LABEL";
  }

  public equals(other: unknown): boolean {
    return other instanceof Segment && this.asString === other.asString;
  }

  public toString(): string {
    return this.asString;
  }

  private _checkForInvalidContents(offset: number | undefined): void {
    const offsetString = offset !== undefined ? " at index " + offset : "";
    if (this.segmentType === "LITERAL") {
      if (this.content.length === 0) {
        throw new InvalidPatternException("Segments must not be empty" + offsetString);
      } else if (this.content.indexOf("{") !== -1 || this.content.indexOf("}") !== -1) {
        throw new InvalidPatternException(
          "Literal segments must not contain `{` or `}` characters. Found segment `" + this.content + "`" + offsetString
        );
      }
    } else if (this.content.length === 0) {
      throw new InvalidPatternException("Empty label declaration in pattern" + offsetString + ".");
    } else if (!ShapeId.isValidIdentifier(this.content)) {
      throw new InvalidPatternException(
        "Invalid label name in pattern: '" +
          this.content +
          "'" +
          offsetString +
          ". Labels must contain value identifiers."
      );
    }
  }
}
