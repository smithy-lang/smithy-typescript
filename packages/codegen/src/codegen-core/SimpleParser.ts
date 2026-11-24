const EOF = "\0";

/**
 * Port of software.amazon.smithy.utils.SimpleParser.
 */
export class SimpleParser {
  private readonly _input: string;
  private readonly _length: number;
  private _position = 0;
  private _line = 1;
  private _column = 1;

  public constructor(input: string) {
    this._input = input;
    this._length = input.length;
  }

  public input(): string {
    return this._input;
  }

  public position(): number {
    return this._position;
  }

  public line(): number {
    return this._line;
  }

  public column(): number {
    return this._column;
  }

  public eof(): boolean {
    return this._position >= this._length;
  }

  public peek(offset = 0): string {
    const target = this._position + offset;
    if (target >= this._length || target < 0) {
      return EOF;
    }
    return this._input.charAt(target);
  }

  public expect(token: string): string {
    if (this.peek() === token) {
      this.skip();
      return token;
    }
    throw this.syntax(`Expected: '${token}', but found '${this.peekSingleCharForMessage()}'`);
  }

  public expectOneOf(tokens: string): string {
    const c = this.peek();
    if (!this.eof() && tokens.indexOf(c) !== -1) {
      this.skip();
      return c;
    }
    let message = `Found '${this.peekSingleCharForMessage()}', but expected one of the following tokens:`;
    for (let i = 0; i < tokens.length; i++) {
      message += ` '${tokens.charAt(i)}'`;
    }
    throw this.syntax(message);
  }

  public peekSingleCharForMessage(): string {
    const peek = this.peek();
    return peek === EOF ? "[EOF]" : peek;
  }

  public syntax(message: string): Error {
    return new Error(`Syntax error at line ${this._line}, column ${this._column}: ${message}`);
  }

  public sp(): void {
    for (let c = this.peek(); c === " " || c === "\t"; c = this.peek()) {
      this.skip();
    }
  }

  public skip(): void {
    if (this.eof()) {
      return;
    }
    const c = this._input.charAt(this._position);
    if (c === "\r") {
      if (this.peek(1) === "\n") {
        this._position++;
      }
      this._line++;
      this._column = 1;
    } else if (c === "\n") {
      this._line++;
      this._column = 1;
    } else {
      this._column++;
    }
    this._position++;
  }

  public sliceFrom(start: number): string {
    return this._input.slice(start, this._position);
  }

  public consumeWhile(predicate: (c: string) => boolean): number {
    const startPosition = this._position;
    for (let ch = this.peek(); ch !== EOF && predicate(ch); ch = this.peek()) {
      this.skip();
    }
    return this._position - startPosition;
  }
}
