import type { AbstractCodeWriter } from "./AbstractCodeWriter";
import { CodeSection } from "./CodeSection";
import { SimpleParser } from "./SimpleParser";

export const VALID_FORMATTER_CHARS = "!%&*+,-.;=@ABCDEFGHIJKLMNOPQRSTUVWXYZ_`";

/**
 * Port of software.amazon.smithy.utils.CodeFormatter.
 */
export class CodeFormatter {
  public static run(writer: AbstractCodeWriter<any>, template: string, args: unknown[]): string {
    const sink = new StringSink();
    const block = new Parser(writer, template, args).parse();
    block(sink, writer);
    return sink.toString();
  }
}

type Writer = AbstractCodeWriter<any>;
type Operation = (sink: Sink, writer: Writer) => void;

interface Sink {
  column(): number;
  append(text: string): void;
  toString(): string;
}

class StringSink implements Sink {
  private _out = "";
  private _column = 0;

  public column(): number {
    return this._column;
  }

  public append(text: string): void {
    if (text.length === 0) {
      return;
    }
    this._out += text;
    const lastLf = text.lastIndexOf("\n");
    const lastCr = text.lastIndexOf("\r");
    const lastBreak = lastLf > lastCr ? lastLf : lastCr;
    this._column = lastBreak === -1 ? this._column + text.length : text.length - lastBreak - 1;
  }

  public toString(): string {
    return this._out;
  }
}

class BlockAlignedSink implements Sink {
  private readonly _spaces: number;
  private readonly _staticWhitespace: string | null;
  private readonly _delegate: Sink;
  private _previousIsCarriageReturn = false;
  private _previousIsNewline = false;

  public constructor(delegate: Sink, staticWhitespace: string | null) {
    this._delegate = delegate;
    this._spaces = delegate.column();
    this._staticWhitespace = staticWhitespace;
  }

  public toString(): string {
    return this._delegate.toString();
  }

  public column(): number {
    return this._delegate.column();
  }

  public append(text: string): void {
    for (let i = 0; i < text.length; i++) {
      this._appendChar(text.charAt(i));
    }
  }

  private _appendChar(c: string): void {
    if (this._previousIsNewline) {
      this._writeSpaces();
      this._previousIsNewline = false;
    }
    if (c === "\n") {
      this._delegate.append("\n");
      this._previousIsNewline = true;
      this._previousIsCarriageReturn = false;
    } else {
      if (this._previousIsCarriageReturn) {
        this._writeSpaces();
      }
      this._previousIsCarriageReturn = c === "\r";
      this._delegate.append(c);
    }
  }

  private _writeSpaces(): void {
    if (this._staticWhitespace !== null) {
      this._delegate.append(this._staticWhitespace);
    } else if (this._spaces > 0) {
      this._delegate.append(" ".repeat(this._spaces));
    }
  }
}

interface BlockOperation {
  readonly variable: string;
  readonly operations: Operation[];
  readonly run: Operation;
}

function stringSlice(source: string, start: number, end: number): Operation {
  return (sink) => sink.append(source.slice(start, end));
}

function formatted(valueGetter: (writer: Writer) => unknown, formatter: string, errorMessage: () => string): Operation {
  return (sink, writer) => {
    const value = valueGetter(writer);
    const result = writer._applyFormatter(formatter, value);
    if (result === null) {
      throw new Error(errorMessage());
    }
    sink.append(result);
  };
}

function inlineSection(sectionName: string, delegate: Operation): Operation {
  return (sink, writer) => {
    const buffer = new StringSink();
    delegate(buffer, writer);
    const defaultValue = buffer.toString();
    const section = CodeSection.forName(sectionName);
    let expanded = writer._expandSection(section, defaultValue, (previous) =>
      writer.writeInlineWithNoFormatting(previous)
    );
    expanded = writer._removeTrailingNewline(expanded);
    sink.append(expanded);
  };
}

function block(delegate: Operation, staticWhitespace: string | null): Operation {
  return (sink, writer) => delegate(new BlockAlignedSink(sink, staticWhitespace), writer);
}

function runAll(operations: Operation[], sink: Sink, writer: Writer): void {
  for (let i = 0; i < operations.length; i++) {
    operations[i](sink, writer);
  }
}

function unconditional(variable: string): BlockOperation {
  const operations: Operation[] = [];
  return { variable, operations, run: (sink, writer) => runAll(operations, sink, writer) };
}

function conditional(variable: string, negate: boolean): BlockOperation {
  const operations: Operation[] = [];
  return {
    variable,
    operations,
    run: (sink, writer) => {
      const value = writer.getContext(variable);
      if (!isConditionTruthy(value) === negate) {
        runAll(operations, sink, writer);
      }
    },
  };
}

function loop(variable: string, keyName: string, valueName: string): BlockOperation {
  const operations: Operation[] = [];
  return {
    variable,
    operations,
    run: (sink, writer) => {
      const entries = getValueEntries(writer.getContext(variable));
      for (let i = 0; i < entries.length; i++) {
        writer.pushState();
        writer.putContext(keyName, entries[i][0]);
        writer.putContext(valueName, entries[i][1]);
        writer.putContext(keyName + ".first", i === 0);
        writer.putContext(keyName + ".last", i === entries.length - 1);
        runAll(operations, sink, writer);
        writer.popState();
      }
    },
  };
}

function isConditionTruthy(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  } else if (typeof value === "boolean") {
    return value;
  } else if (typeof value === "string") {
    return value.length > 0;
  } else if (value instanceof Map) {
    return value.size > 0;
  } else if (Array.isArray(value)) {
    return value.length > 0;
  } else if (value instanceof Set) {
    return value.size > 0;
  } else if (typeof (value as Iterable<unknown>)[Symbol.iterator] === "function") {
    return !(value as Iterable<unknown>)[Symbol.iterator]().next().done;
  }
  return true;
}

function getValueEntries(value: unknown): [unknown, unknown][] {
  if (value instanceof Map) {
    return Array.from(value.entries());
  } else if (typeof value === "object" && value !== null && typeof (value as any)[Symbol.iterator] === "function") {
    const result: [unknown, unknown][] = [];
    let position = 0;
    for (const item of value as Iterable<unknown>) {
      result.push([position++, item]);
    }
    return result;
  }
  return [];
}

function isJavaWhitespace(c: string): boolean {
  const code = c.charCodeAt(0);
  return (
    code === 0x20 ||
    (code >= 0x09 && code <= 0x0d) ||
    (code >= 0x1c && code <= 0x1f) ||
    (code > 0x7f && /\s/.test(c) && code !== 0xa0 && code !== 0x2007 && code !== 0x202f && code !== 0xfeff)
  );
}

const LOWER_CASE = /^\p{Ll}$/u;

class Parser {
  private readonly _template: string;
  private readonly _parser: SimpleParser;
  private readonly _expressionStart: string;
  private readonly _writer: Writer;
  private readonly _arguments: unknown[];
  private readonly _positionals: boolean[];
  private _relativeIndex = 0;
  private readonly _blocks: BlockOperation[] = [];

  public constructor(writer: Writer, template: string, args: unknown[]) {
    this._template = template;
    this._writer = writer;
    this._expressionStart = writer.getExpressionStart();
    this._parser = new SimpleParser(template);
    this._arguments = args;
    this._positionals = new Array<boolean>(args.length).fill(false);
    this._blocks.push(unconditional(""));
  }

  public parse(): Operation {
    const parser = this._parser;
    let parsingLiteral = false;
    let literalStartCharacter = 0;

    while (!parser.eof()) {
      const c = parser.peek();
      parser.skip();
      if (c !== this._expressionStart) {
        parsingLiteral = true;
      } else if (parser.peek() === this._expressionStart) {
        this._pushOperation(stringSlice(this._template, literalStartCharacter, parser.position()));
        parser.expect(this._expressionStart);
        parsingLiteral = true;
        literalStartCharacter = parser.position();
      } else {
        const pendingTextStart = parsingLiteral ? literalStartCharacter : -1;
        parsingLiteral = false;
        this._parseArgument(pendingTextStart);
        literalStartCharacter = parser.position();
      }
    }

    if (parsingLiteral) {
      this._pushOperation(stringSlice(this._template, literalStartCharacter, parser.position()));
    }

    if (this._relativeIndex === -1) {
      this._ensureAllPositionalArgumentsWereUsed();
    } else if (this._relativeIndex < this._arguments.length) {
      const unusedCount = this._arguments.length - this._relativeIndex;
      throw this._error(`Found ${unusedCount} unused relative format arguments`);
    }

    if (this._blocks.length === 1) {
      return this._blocks[0].run;
    }

    const open = this._blocks
      .filter((b) => b.variable.length > 0)
      .map((b) => b.variable)
      .reverse();
    throw new Error("Unclosed parse conditional blocks: [" + open.join(", ") + "]");
  }

  private _top(): BlockOperation {
    return this._blocks[this._blocks.length - 1];
  }

  private _pushOperation(op: Operation): void {
    this._top().operations.push(op);
  }

  private _error(message: string): Error {
    return this._parser.syntax(this._createErrorMessage(message));
  }

  private _createErrorMessage(message: string): string {
    return message + " (template: " + this._template + ") " + this._writer.getDebugInfo();
  }

  private _ensureAllPositionalArgumentsWereUsed(): void {
    let unused = 0;
    for (const b of this._positionals) {
      if (!b) {
        unused++;
      }
    }
    if (unused > 0) {
      throw this._error(`Found ${unused} unused positional format arguments`);
    }
  }

  private _parseArgument(pendingTextStart: number): void {
    const parser = this._parser;
    if (parser.peek() === "{") {
      this._parseBracedArgument(pendingTextStart);
    } else {
      if (pendingTextStart > -1) {
        this._pushOperation(stringSlice(parser.input(), pendingTextStart, parser.position() - 1));
      }
      this._pushOperation(this._parseNormalArgument());
    }
  }

  private _parseBracedArgument(pendingTextStart: number): void {
    const parser = this._parser;
    let startPosition = parser.position() - 1;
    const startColumn = parser.column() - 2;
    let stripLeading = false;

    parser.expect("{");

    if (parser.peek() === "~") {
      stripLeading = true;
      parser.skip();
      if (pendingTextStart > -1) {
        while (startPosition > pendingTextStart && isJavaWhitespace(parser.input().charAt(startPosition - 1))) {
          startPosition--;
        }
      }
    }

    if (parser.peek() === "?" || parser.peek() === "^" || parser.peek() === "#") {
      this._pushBlock(pendingTextStart, startPosition, startColumn, parser.peek());
      return;
    }

    if (parser.peek() === "/") {
      this._popBlock(pendingTextStart, startPosition, startColumn);
      return;
    }

    if (pendingTextStart > -1) {
      this._pushOperation(stringSlice(parser.input(), pendingTextStart, startPosition));
    }

    let operation = this._parseNormalArgument();

    if (parser.peek() === "@") {
      parser.skip();
      const start = parser.position();
      parser.consumeWhile((c) => this._isNameCharacter(c));
      const sectionName = parser.sliceFrom(start);
      this._ensureNameIsValid(sectionName);
      operation = inlineSection(sectionName, operation);
    }

    if (parser.peek() === "|") {
      if (stripLeading) {
        throw this._error("Cannot strip leading whitespace with '~' when using inline block alignment '|'");
      }
      const staticWhitespace = this._isAllLeadingWhitespaceOnLine(startPosition, startColumn)
        ? this._template.slice(startPosition - startColumn, startPosition)
        : null;
      parser.expect("|");
      operation = block(operation, staticWhitespace);
    }

    const skipTrailingWs = this._parseStripTrailingWhitespace();
    parser.expect("}");
    this._pushOperation(operation);

    if (skipTrailingWs) {
      this._skipTrailingWhitespaceInParser();
    }
  }

  private _parseStripTrailingWhitespace(): boolean {
    if (this._parser.peek() === "~") {
      this._parser.skip();
      return true;
    }
    return false;
  }

  private _skipTrailingWhitespaceInParser(): void {
    this._parser.consumeWhile(isJavaWhitespace);
  }

  private _isAllLeadingWhitespaceOnLine(startPosition: number, startColumn: number): boolean {
    for (let i = startPosition - startColumn; i < startPosition; i++) {
      const ch = this._template.charAt(i);
      if (ch !== " " && ch !== "\t") {
        return false;
      }
    }
    return true;
  }

  private _pushBlock(pendingTextStart: number, startPosition: number, startColumn: number, c: string): void {
    const parser = this._parser;
    parser.expect(c);
    const name = this._parseArgumentName();
    let blockOperation: BlockOperation;

    switch (c) {
      case "#": {
        let keyPrefix = "key";
        let value = "value";
        if (parser.peek() === " ") {
          parser.sp();
          parser.expect("a");
          parser.expect("s");
          parser.sp();
          let startPos = parser.position();
          parser.consumeWhile((ch) => this._isNameCharacter(ch));
          keyPrefix = parser.sliceFrom(startPos);
          this._ensureNameIsValid(keyPrefix);
          parser.expect(",");
          parser.sp();
          startPos = parser.position();
          parser.consumeWhile((ch) => this._isNameCharacter(ch));
          value = parser.sliceFrom(startPos);
          this._ensureNameIsValid(value);
        }
        blockOperation = loop(name, keyPrefix, value);
        break;
      }
      case "^":
        blockOperation = conditional(name, true);
        break;
      default:
        blockOperation = conditional(name, false);
    }

    const skipTrailingWs = this._parseStripTrailingWhitespace();
    parser.expect("}");
    this._handleConditionalOnLine(pendingTextStart, startPosition, startColumn);
    this._blocks.push(blockOperation);

    if (skipTrailingWs) {
      this._skipTrailingWhitespaceInParser();
    }
  }

  private _handleConditionalOnLine(pendingTextStart: number, startPosition: number, startColumn: number): void {
    const parser = this._parser;
    const next = parser.peek();
    if (next !== "\r" && next !== "\n" && next !== "\0") {
      if (pendingTextStart > -1) {
        this._pushOperation(stringSlice(parser.input(), pendingTextStart, startPosition));
      }
    } else if (this._isAllLeadingWhitespaceOnLine(startPosition, startColumn)) {
      if (pendingTextStart > -1) {
        this._pushOperation(stringSlice(parser.input(), pendingTextStart, startPosition - startColumn));
      }
      parser.skip();
    } else if (pendingTextStart > -1) {
      this._pushOperation(stringSlice(parser.input(), pendingTextStart, startPosition));
    }
  }

  private _popBlock(pendingTextStart: number, startPosition: number, startColumn: number): void {
    const parser = this._parser;
    parser.expect("/");
    const name = this._parseArgumentName();
    parser.expect("}");

    if (this._blocks.length === 1) {
      throw new Error("Attempted to close unopened tag: '" + name + "'");
    }

    this._handleConditionalOnLine(pendingTextStart, startPosition, startColumn);
    const popped = this._blocks.pop() as BlockOperation;

    if (popped.variable !== name) {
      throw new Error("Invalid closing tag: '" + name + "'. Expected: '" + popped.variable + "'");
    }

    this._top().operations.push(popped.run);
  }

  private _parseNormalArgument(): Operation {
    const parser = this._parser;
    const c = parser.peek();
    let getter: (writer: Writer) => unknown;

    if (LOWER_CASE.test(c)) {
      const name = this._parseNamedArgumentName();
      getter = (w) => w.getContext(name);
    } else if (c >= "0" && c <= "9") {
      getter = this._parsePositionalArgumentGetter();
    } else {
      getter = this._parseRelativeArgumentGetter();
    }

    const line = parser.line();
    const column = parser.column();
    const identifier = parser.expectOneOf(VALID_FORMATTER_CHARS);
    return formatted(getter, identifier, () =>
      this._createErrorMessage(
        `Syntax error at line ${line} column ${column}: Unknown formatter \`${identifier}\` found in format string`
      )
    );
  }

  private _parseArgumentName(): string {
    const start = this._parser.position();
    this._parser.consumeWhile((c) => this._isNameCharacter(c));
    const name = this._parser.sliceFrom(start);
    this._ensureNameIsValid(name);
    return name;
  }

  private _parseNamedArgumentName(): string {
    const name = this._parseArgumentName();
    this._parser.expect(":");
    if (this._parser.eof()) {
      throw this._error("Expected an identifier after the ':' in a named argument");
    }
    return name;
  }

  private _parseRelativeArgumentGetter(): (writer: Writer) => unknown {
    if (this._relativeIndex === -1) {
      throw this._error("Cannot mix positional and relative arguments");
    }
    this._relativeIndex++;
    const result = this._getPositionalArgument(this._relativeIndex - 1);
    return () => result;
  }

  private _getPositionalArgument(index: number): unknown {
    if (index >= this._arguments.length) {
      throw this._error(`Given ${this._arguments.length} arguments but attempted to format index ${index}`);
    }
    this._positionals[index] = true;
    return this._arguments[index];
  }

  private _parsePositionalArgumentGetter(): (writer: Writer) => unknown {
    if (this._relativeIndex > 0) {
      throw this._error("Cannot mix positional and relative arguments");
    }
    this._relativeIndex = -1;
    const parser = this._parser;
    const startPosition = parser.position();
    parser.consumeWhile((c) => c >= "0" && c <= "9");
    const index = parseInt(parser.sliceFrom(startPosition), 10) - 1;

    if (index < 0 || index >= this._arguments.length) {
      throw this._error(
        `Positional argument index ${index} out of range of provided ${this._arguments.length} arguments in format string`
      );
    }

    const value = this._getPositionalArgument(index);
    return () => value;
  }

  private _ensureNameIsValid(name: string): void {
    if (name.length === 0 || name.charAt(0) < "a" || name.charAt(0) > "z") {
      throw this._error(`Invalid format expression name \`${name}\``);
    }
    for (let i = 1; i < name.length; i++) {
      if (!this._isNameCharacter(name.charAt(i))) {
        throw this._error(`Invalid format expression name \`${name}\``);
      }
    }
  }

  private _isNameCharacter(c: string): boolean {
    return (
      (c >= "a" && c <= "z") ||
      (c >= "A" && c <= "Z") ||
      (c >= "0" && c <= "9") ||
      c === "_" ||
      c === "." ||
      c === "#" ||
      c === "$"
    );
  }
}
