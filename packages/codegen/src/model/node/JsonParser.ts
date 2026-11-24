/**
 * Parses JSON like `JSON.parse`, and remembers the source text of each number.
 * A parsed JS number cannot tell `2.0` from `2`, or keep digits beyond double precision, while Smithy's number
 * nodes keep both.
 *
 * @internal
 */
export class JsonParser {
  /**
   * Parses the text, using the native reviver's `source` when the runtime provides it and a custom parser otherwise.
   */
  public static parse(text: string, preferReviver = true): unknown {
    if (preferReviver && REVIVER_HAS_SOURCE) {
      return JSON.parse(text, recordingReviver as (key: string, value: unknown) => unknown);
    }
    return new CustomParser(text).parse();
  }

  /**
   * Returns the source text of the number stored at `holder[key]`, if the holder came from this parser.
   */
  public static getNumberSource(holder: object, key: string | number): string | undefined {
    return NUMBER_SOURCES.get(holder)?.get(String(key));
  }
}

const NUMBER_SOURCES = new WeakMap<object, Map<string, string>>();

const recordNumber = (holder: object, key: string, source: string): void => {
  let sources = NUMBER_SOURCES.get(holder);
  if (sources === undefined) {
    sources = new Map();
    NUMBER_SOURCES.set(holder, sources);
  }
  sources.set(key, source);
};

/**
 * Captures number lexemes through the third reviver argument, which runtimes before Node.js 21 do not pass.
 */
function recordingReviver(this: object, key: string, value: unknown, context?: { source?: string }): unknown {
  if (typeof value === "number" && context?.source !== undefined) {
    recordNumber(this, key, context.source);
  }
  return value;
}

const REVIVER_HAS_SOURCE = ((): boolean => {
  let supported = false;
  const probe = function (key: string, value: unknown, context?: { source?: string }): unknown {
    if (key === "0") {
      supported = context?.source === "1.0";
    }
    return value;
  };
  JSON.parse("[1.0]", probe as (key: string, value: unknown) => unknown);
  return supported;
})();

const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

class CustomParser {
  private _position = 0;

  public constructor(private readonly _text: string) {}

  public parse(): unknown {
    this._skipWhitespace();
    const value = this._parseValue(undefined, "");
    this._skipWhitespace();
    if (this._position !== this._text.length) {
      throw this._error("Unexpected non-whitespace character after JSON");
    }
    return value;
  }

  private _parseValue(holder: object | undefined, key: string): unknown {
    const char = this._text.charCodeAt(this._position);
    switch (char) {
      case 0x7b:
        return this._parseObject();
      case 0x5b:
        return this._parseArray();
      case 0x22:
        return this._parseString();
      case 0x74:
        return this._parseLiteral("true", true);
      case 0x66:
        return this._parseLiteral("false", false);
      case 0x6e:
        return this._parseLiteral("null", null);
      default:
        return this._parseNumber(holder, key);
    }
  }

  private _parseObject(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    this._position++;
    this._skipWhitespace();
    if (this._text.charCodeAt(this._position) === 0x7d) {
      this._position++;
      return result;
    }
    for (;;) {
      this._skipWhitespace();
      if (this._text.charCodeAt(this._position) !== 0x22) {
        throw this._error("Expected a string key");
      }
      const key = this._parseString();
      this._skipWhitespace();
      this._expect(0x3a);
      this._skipWhitespace();
      const value = this._parseValue(result, key);
      // CAUTION: plain assignment of "__proto__" would replace the prototype instead of adding a property.
      Object.defineProperty(result, key, { value, writable: true, enumerable: true, configurable: true });
      this._skipWhitespace();
      const next = this._text.charCodeAt(this._position++);
      if (next === 0x7d) {
        return result;
      }
      if (next !== 0x2c) {
        this._position--;
        throw this._error("Expected ',' or '}'");
      }
    }
  }

  private _parseArray(): unknown[] {
    const result: unknown[] = [];
    this._position++;
    this._skipWhitespace();
    if (this._text.charCodeAt(this._position) === 0x5d) {
      this._position++;
      return result;
    }
    for (;;) {
      this._skipWhitespace();
      result.push(this._parseValue(result, String(result.length)));
      this._skipWhitespace();
      const next = this._text.charCodeAt(this._position++);
      if (next === 0x5d) {
        return result;
      }
      if (next !== 0x2c) {
        this._position--;
        throw this._error("Expected ',' or ']'");
      }
    }
  }

  private _parseString(): string {
    const start = ++this._position;
    let result = "";
    let chunkStart = start;
    for (;;) {
      const char = this._text.charCodeAt(this._position);
      if (Number.isNaN(char)) {
        throw this._error("Unterminated string");
      }
      if (char === 0x22) {
        result += this._text.slice(chunkStart, this._position);
        this._position++;
        return result;
      }
      if (char < 0x20) {
        throw this._error("Bad control character in string");
      }
      if (char === 0x5c) {
        result += this._text.slice(chunkStart, this._position);
        result += this._parseEscape();
        chunkStart = this._position;
        continue;
      }
      this._position++;
    }
  }

  private _parseEscape(): string {
    const escape = this._text[this._position + 1];
    this._position += 2;
    switch (escape) {
      case '"':
        return '"';
      case "\\":
        return "\\";
      case "/":
        return "/";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "u": {
        const hex = this._text.slice(this._position, this._position + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
          throw this._error("Bad Unicode escape");
        }
        this._position += 4;
        return String.fromCharCode(parseInt(hex, 16));
      }
      default:
        this._position -= 2;
        throw this._error("Bad escaped character");
    }
  }

  private _parseNumber(holder: object | undefined, key: string): number {
    NUMBER_PATTERN.lastIndex = this._position;
    const match = NUMBER_PATTERN.exec(this._text);
    if (match === null) {
      throw this._error("Unexpected token");
    }
    const source = match[0];
    this._position += source.length;
    if (holder !== undefined) {
      recordNumber(holder, key, source);
    }
    return Number(source);
  }

  private _parseLiteral<T>(literal: string, value: T): T {
    if (!this._text.startsWith(literal, this._position)) {
      throw this._error("Unexpected token");
    }
    this._position += literal.length;
    return value;
  }

  private _expect(char: number): void {
    if (this._text.charCodeAt(this._position) !== char) {
      throw this._error(`Expected '${String.fromCharCode(char)}'`);
    }
    this._position++;
  }

  private _skipWhitespace(): void {
    for (;;) {
      const char = this._text.charCodeAt(this._position);
      if (char === 0x20 || char === 0x0a || char === 0x0d || char === 0x09) {
        this._position++;
      } else {
        return;
      }
    }
  }

  private _error(message: string): SyntaxError {
    return new SyntaxError(`${message} in JSON at position ${this._position}`);
  }
}
