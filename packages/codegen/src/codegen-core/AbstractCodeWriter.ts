import type { CodeInterceptor } from "./CodeInterceptor";
import { CodeFormatter, VALID_FORMATTER_CHARS } from "./CodeFormatter";
import { CodeSection } from "./CodeSection";
import { CodeWriterDebugInfo } from "./CodeWriterDebugInfo";
import { StringUtils } from "./StringUtils";

type CodeFormatterFunction = (value: unknown, indent: string) => string;

type AnyInterceptor<T extends AbstractCodeWriter<T>> = CodeInterceptor<any, T>;

type ContextType<C> = (abstract new (...args: any[]) => C) | StringConstructor | NumberConstructor | BooleanConstructor;

const MIN_INDENT = -2147483648;

/**
 * Port of software.amazon.smithy.utils.AbstractCodeWriter.
 */
export abstract class AbstractCodeWriter<T extends AbstractCodeWriter<T>> {
  private readonly _states: State<T>[] = [];
  private _currentState: State<T>;
  private _trailingNewline = true;
  private _trimBlankLines = -1;
  private _enableStackTraceComments = false;
  private readonly _deferredSuppliers: (() => string)[] = [];
  private _deferredCounter = 0;

  public constructor() {
    const root = new State<T>(this, null);
    this._states.push(root);
    this._currentState = root;
    root.needsIndentation = true;
  }

  public static formatLiteral(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    } else if (typeof value === "string") {
      return value;
    } else if (Array.isArray(value) || value instanceof Set) {
      return "[" + Array.from(value as Iterable<unknown>, (v) => AbstractCodeWriter.formatLiteral(v)).join(", ") + "]";
    } else if (value instanceof Map) {
      const parts: string[] = [];
      for (const [k, v] of value) {
        parts.push(AbstractCodeWriter.formatLiteral(k) + "=" + AbstractCodeWriter.formatLiteral(v));
      }
      return "{" + parts.join(", ") + "}";
    }
    return String(value);
  }

  public putFormatter(identifier: string, formatFunction: CodeFormatterFunction): this {
    this._currentState.putFormatter(identifier, formatFunction);
    return this;
  }

  public getExpressionStart(): string {
    return this._currentState.expressionStart;
  }

  public toString(): string {
    const state = this._currentState;
    let result = state.toString();

    if (this._deferredCounter > 0) {
      result = this._resolveDeferred(result);
    }

    if (this._trimBlankLines > -1) {
      result = this._applyTrimBlankLines(result, state.newline);
    }

    if (result.length === 0) {
      return this._trailingNewline ? state.newline : "";
    }

    if (state.trimTrailingSpaces) {
      result = StringUtils.stripEnd(result, " ");
    }

    if (this._trailingNewline) {
      return result.endsWith(state.newline) ? result : result + state.newline;
    } else if (result.endsWith(state.newline)) {
      return result.slice(0, result.length - state.newline.length);
    }
    return result;
  }

  public pushState(sectionName?: string | CodeSection): this {
    this._currentState = new State<T>(this, this._currentState);
    this._states.push(this._currentState);
    if (sectionName !== undefined) {
      const section = typeof sectionName === "string" ? CodeSection.forName(sectionName) : sectionName;
      this._currentState.makeInterceptableCodeSection(section);
    }
    return this;
  }

  public injectSection(section: CodeSection): this {
    return this.pushState(section).popState();
  }

  public getDebugInfo(numberOfContextLines = 2): CodeWriterDebugInfo {
    const info = new CodeWriterDebugInfo();
    info.putMetadata("path", this._states.map((s) => s.getSectionName()).join("/"));

    if (numberOfContextLines < 0) {
      throw new Error("Cannot get fewer than 0Lines");
    } else if (numberOfContextLines > 0) {
      let lastLines = "";
      const str = this.toString();
      if (str.length > 0) {
        const lines = str.split(/\r?\n/);
        while (lines.length > 0 && lines[lines.length - 1] === "") {
          lines.pop();
        }
        const startPosition = Math.max(0, lines.length - numberOfContextLines);
        for (let i = startPosition; i < lines.length; i++) {
          lastLines += lines[i] + "\\n";
        }
      }
      info.putMetadata("near", lastLines);
    }

    return info;
  }

  public popState(): this {
    if (this._states.length === 1) {
      throw new Error("Cannot pop writer state because at the root state");
    }

    const popped = this._states.pop() as State<T>;
    this._currentState = this._states[this._states.length - 1];
    const sectionValue = popped.sectionValue;

    if (sectionValue !== null) {
      let result = popped.toString();

      if (!(sectionValue instanceof AnonymousCodeSection)) {
        for (const state of this._states) {
          result = this._applyPoppedInterceptors(popped, state, sectionValue, result);
        }
        result = this._applyPoppedInterceptors(popped, popped, sectionValue, result);
      }

      if (popped.isInline) {
        popped.builder.value = result;
      } else if (result.length > 0) {
        this.writeInlineWithNoFormatting(result);
      }
    }

    if (!popped.isInline && popped.needsIndentation) {
      this._currentState.needsIndentation = true;
    }

    return this;
  }

  public onSection(interceptor: AnyInterceptor<T>): this;
  public onSection(sectionName: string, interceptor: (content: string) => void): this;
  public onSection(first: string | AnyInterceptor<T>, second?: (content: string) => void): this {
    if (typeof first === "string") {
      const consumer = second as (content: string) => void;
      this._currentState.putInterceptor(
        CodeInterceptorByName<T>(first, (_w, p) => consumer(this._removeTrailingNewline(p)))
      );
    } else {
      this._currentState.putInterceptor(first);
    }
    return this;
  }

  public getNewline(): string {
    return this._currentState.newline;
  }

  public setIndentText(indentText: string): this {
    this._currentState.indent(0, indentText);
    return this;
  }

  public getIndentText(): string {
    return this._currentState.indentText;
  }

  public trimTrailingSpaces(trimTrailingSpaces = true): this {
    this._currentState.trimTrailingSpaces = trimTrailingSpaces;
    return this;
  }

  public trimBlankLines(trimBlankLines = 1): this {
    this._trimBlankLines = trimBlankLines;
    return this;
  }

  public setNewlinePrefix(newlinePrefix: string): this {
    this._currentState.newlinePrefix = newlinePrefix;
    return this;
  }

  public indent(levels = 1): this {
    this._currentState.indent(levels, null);
    return this;
  }

  public dedent(levels = 1): this {
    this._currentState.indent(levels === -1 ? MIN_INDENT : -1 * levels, null);
    return this;
  }

  public openBlock(
    textBeforeNewline: string,
    textAfterNewline: string,
    ...argsAndRunnable: [...unknown[], () => void]
  ): this;
  public openBlock(textBeforeNewline: string, ...args: unknown[]): this;
  public openBlock(textBeforeNewline: string, ...rest: unknown[]): this {
    const last = rest[rest.length - 1];
    if (rest.length >= 2 && typeof rest[0] === "string" && typeof last === "function") {
      const args = rest.slice(1, rest.length - 1);
      this.write(textBeforeNewline, ...args).indent();
      (last as () => void)();
      return this.closeBlock(rest[0]);
    }
    return this.write(textBeforeNewline, ...rest).indent();
  }

  public closeBlock(textAfterNewline: string, ...args: unknown[]): this {
    return this.dedent().write(textAfterNewline, ...args);
  }

  public writeWithNoFormatting(content: unknown): this {
    this._currentState.writeLine(this._findAndFormatStackTraceElement(String(content), false));
    return this;
  }

  public writeInlineWithNoFormatting(content: unknown): this {
    this._currentState.write(this._findAndFormatStackTraceElement(String(content), true));
    return this;
  }

  public format(content: unknown, ...args: unknown[]): string {
    if (content === null || content === undefined) {
      throw new TypeError("content must not be null");
    }
    return CodeFormatter.run(this, String(content), args);
  }

  public call(task: () => void): this {
    task();
    return this;
  }

  public write(content: unknown, ...args: unknown[]): this {
    return this.writeWithNoFormatting(this.format(content, ...args));
  }

  public writeInline(content: unknown, ...args: unknown[]): this {
    return this.writeInlineWithNoFormatting(this.format(content, ...args));
  }

  public ensureNewline(): this {
    const nl = this.getNewline();
    const value = this._currentState.builder.value;
    if (!(value.length > nl.length && value.endsWith(nl))) {
      this.write("");
    }
    return this;
  }

  public unwrite(content: unknown, ...args: unknown[]): this {
    const value = this.format(content, ...args);
    const builder = this._currentState.builder;
    const currentLength = builder.value.length;
    if (builder.value.lastIndexOf(value) === currentLength - value.length) {
      builder.value = builder.value.slice(0, currentLength - value.length);
    }
    return this;
  }

  public putContext(key: string, value: unknown): this;
  public putContext(mappings: Record<string, unknown> | Map<string, unknown>): this;
  public putContext(keyOrMappings: string | Record<string, unknown> | Map<string, unknown>, value?: unknown): this {
    if (typeof keyOrMappings === "string") {
      this._currentState.context.set(keyOrMappings, value);
    } else if (keyOrMappings instanceof Map) {
      for (const [k, v] of keyOrMappings) {
        this._currentState.context.set(k, v);
      }
    } else {
      for (const k of Object.keys(keyOrMappings)) {
        this._currentState.context.set(k, keyOrMappings[k]);
      }
    }
    return this;
  }

  public getContext(key: string): unknown;
  public getContext<C>(key: string, type: ContextType<C>): C | null;
  public getContext(key: string, type?: ContextType<unknown>): unknown {
    let value: unknown = null;
    let found = false;
    for (let i = this._states.length - 1; i >= 0; i--) {
      const state = this._states[i];
      if (state.context.has(key)) {
        value = state.context.get(key);
        found = true;
        break;
      } else if (state.sectionValue !== null) {
        const name = findContextMethod(state.sectionValue, key);
        if (name !== null) {
          try {
            value = (state.sectionValue as any)[name]();
          } catch (e) {
            throw new Error(
              `Unable to get context '${key}' from a matching method of the current CodeSection: ${
                e instanceof Error ? e.message : String(e)
              } ${this.getDebugInfo()}`
            );
          }
          found = true;
          break;
        }
      }
    }

    if (!found || value === null || value === undefined) {
      return null;
    }

    if (type === undefined) {
      return value;
    }

    const ok =
      type === String
        ? typeof value === "string"
        : type === Number
          ? typeof value === "number"
          : type === Boolean
            ? typeof value === "boolean"
            : value instanceof (type as abstract new (...args: any[]) => unknown);
    if (!ok) {
      throw new TypeError(
        `Expected context value '${key}' to be an instance of ${(type as { name: string }).name}, but found ${
          (value as object).constructor?.name ?? typeof value
        } ${this.getDebugInfo()}`
      );
    }
    return value;
  }

  /**
   * @internal
   */
  public _expandSection(section: CodeSection, previousContent: string, consumer: (previous: string) => void): string {
    const buffer = new StringBuffer();
    this.pushState(section);
    this._currentState.makeSectionInline(buffer);
    consumer(previousContent);
    this.popState();
    return buffer.value;
  }

  /**
   * @internal
   */
  public _applyFormatter(identifier: string, value: unknown): string | null {
    const f = this._resolveFormatter(identifier);
    if (f !== null) {
      return f(value, this.getIndentText());
    } else if (identifier === "C") {
      const section = new AnonymousCodeSection("__C_formatter_" + this._states.length);
      if (typeof value === "function") {
        return this._removeTrailingNewline(
          this._expandSection(section, "", () => (value as (writer: T) => void)(this as unknown as T))
        );
      }
      throw new TypeError(
        `Expected value for 'C' formatter to be a function, but found ${
          value === null || value === undefined ? "null" : (value as object).constructor?.name
        } ${this.getDebugInfo()}`
      );
    }
    return null;
  }

  /**
   * @internal
   */
  public _removeTrailingNewline(value: string): string {
    const nl = this._currentState.newline;
    return value.endsWith(nl) ? value.slice(0, value.length - nl.length) : value;
  }

  protected _isStackTraceRelevant(frame: string): boolean {
    return !frame.includes("AbstractCodeWriter") && !frame.includes("CodeFormatter") && !frame.includes("node:");
  }

  protected _formatWithStackTraceElement(content: string, element: string, inline: boolean): string {
    void inline;
    return "/* " + element + " */ " + content;
  }

  private _resolveDeferred(result: string): string {
    let resolved = "";
    let pos = 0;
    let fromIndex = 0;
    const len = result.length;
    while (fromIndex < len) {
      if (result.charAt(fromIndex) === "\0" && fromIndex + 1 < len && result.charAt(fromIndex + 1) === "\0") {
        const idStart = fromIndex + 2;
        const end = result.indexOf("\0\0", idStart);
        if (end !== -1) {
          let id = 0;
          for (let k = idStart; k < end; k++) {
            id = id * 10 + (result.charCodeAt(k) - 48);
          }
          resolved += result.slice(pos, fromIndex) + this._deferredSuppliers[id]();
          fromIndex += end + 2 - fromIndex;
          pos = fromIndex;
          continue;
        }
      }
      fromIndex++;
    }
    return pos > 0 ? resolved + result.slice(pos) : result;
  }

  private _applyTrimBlankLines(result: string, newline: string): string {
    let builder = "";
    let blankCount = 0;
    let start = 0;
    const len = result.length;
    let lastNonBlankEnd = 0;

    while (start < len) {
      const newlineIdx = result.indexOf("\n", start);
      const lineEnd = newlineIdx === -1 ? len : newlineIdx;
      const lineContentEnd = lineEnd > start && result.charAt(lineEnd - 1) === "\r" ? lineEnd - 1 : lineEnd;
      const blank = StringUtils.isBlank(result, start, lineContentEnd);

      if (!blank) {
        builder += result.slice(start, lineContentEnd) + newline;
        blankCount = 0;
        lastNonBlankEnd = builder.length;
      } else if (blankCount++ < this._trimBlankLines) {
        builder += result.slice(start, lineContentEnd) + newline;
      }
      start = newlineIdx === -1 ? len : newlineIdx + 1;
    }

    return builder.slice(0, lastNonBlankEnd);
  }

  private _findAndFormatStackTraceElement(content: string, inline: boolean): string {
    if (this._enableStackTraceComments) {
      const lines = (new Error().stack ?? "").split("\n").slice(1);
      for (const line of lines) {
        if (this._isStackTraceRelevant(line)) {
          return this._formatWithStackTraceElement(content, line.trim().replace(/^at /, ""), inline);
        }
      }
    }
    return content;
  }

  private _applyPoppedInterceptors(
    popped: State<T>,
    state: State<T>,
    sectionValue: CodeSection,
    result: string
  ): string {
    for (const interceptor of state.getInterceptors(sectionValue)) {
      result = this._interceptSection(popped, interceptor, result);
    }
    return result;
  }

  private _interceptSection(popped: State<T>, interceptor: AnyInterceptor<T>, previous: string): string {
    return this._expandSection(new AnonymousCodeSection("__" + popped.getSectionName()), previous, () => {
      interceptor.write(this as unknown as T, previous, popped.sectionValue as CodeSection);
    });
  }

  private _resolveFormatter(identifier: string): CodeFormatterFunction | null {
    for (let i = this._states.length - 1; i >= 0; i--) {
      const result = this._states[i].formatters.get(identifier);
      if (result !== undefined) {
        return result;
      }
    }
    return null;
  }
}

class StringBuffer {
  public value = "";
}

class AnonymousCodeSection implements CodeSection {
  private readonly _sectionName: string;

  public constructor(sectionName: string) {
    this._sectionName = sectionName;
  }

  public sectionName(): string {
    return this._sectionName;
  }
}

class State<T extends AbstractCodeWriter<T>> {
  public indentText = "    ";
  public newlinePrefix = "";
  public indentation = 0;
  public trimTrailingSpaces = false;
  public disableNewline = false;
  public newline = "\n";
  public expressionStart = "$";
  public needsIndentation = false;
  public sectionValue: CodeSection | null = null;
  public readonly context = new Map<string, unknown>();
  public readonly formatters = new Map<string, CodeFormatterFunction>();
  public readonly interceptors: AnyInterceptor<T>[] = [];
  public builder: StringBuffer;
  public isInline = false;
  private _leadingIndentString = "";
  private readonly _isRoot: boolean;
  private readonly _writer: AbstractCodeWriter<T>;

  public constructor(writer: AbstractCodeWriter<T>, copy: State<T> | null) {
    this._writer = writer;
    if (copy === null) {
      this._isRoot = true;
      this.builder = new StringBuffer();
      this.formatters.set("L", (s) => AbstractCodeWriter.formatLiteral(s));
      this.formatters.set("S", (s, i) => StringUtils.escapeJavaString(AbstractCodeWriter.formatLiteral(s), i));
    } else {
      this._isRoot = false;
      this.copyStateFrom(copy);
      this.builder = copy.builder;
    }
  }

  public copyStateFrom(copy: State<T>): void {
    this.newline = copy.newline;
    this.expressionStart = copy.expressionStart;
    this.indentText = copy.indentText;
    this._leadingIndentString = copy._leadingIndentString;
    this.indentation = copy.indentation;
    this.newlinePrefix = copy.newlinePrefix;
    this.trimTrailingSpaces = copy.trimTrailingSpaces;
    this.disableNewline = copy.disableNewline;
    this.needsIndentation = copy.needsIndentation;
  }

  public toString(): string {
    return this.builder.value;
  }

  public write(contents: string): void {
    let position = 0;
    let nextNewline = contents.indexOf(this.newline);

    while (nextNewline > -1) {
      if (nextNewline > position) {
        this._appendText(contents.slice(position, nextNewline));
      }
      this._writeNewline();
      position = nextNewline + this.newline.length;
      nextNewline = contents.indexOf(this.newline, position);
    }

    if (position < contents.length) {
      this._appendText(position === 0 ? contents : contents.slice(position));
    }
  }

  public writeLine(line: string): void {
    this.write(line);
    if (!this.disableNewline) {
      this._writeNewline();
    }
  }

  public indent(levels: number, indentText: string | null): void {
    if (levels === MIN_INDENT) {
      this.indentation = 0;
    } else if (levels + this.indentation < 0) {
      throw new Error(`Cannot dedent writer ${levels} levels`);
    } else {
      this.indentation += levels;
    }

    if (indentText !== null) {
      this.indentText = indentText;
    }

    this._leadingIndentString = StringUtils.repeat(this.indentText, this.indentation);
  }

  public makeSectionInline(buffer: StringBuffer): void {
    this.isInline = true;
    this.builder = buffer;
  }

  public makeInterceptableCodeSection(section: CodeSection): void {
    this.sectionValue = section;
    this.builder = new StringBuffer();
    this.newlinePrefix = "";
    this.indent(MIN_INDENT, null);
  }

  public getSectionName(): string {
    if (this._isRoot) {
      return "ROOT";
    } else if (this.sectionValue === null) {
      return "UNNAMED";
    }
    return this.sectionValue.sectionName();
  }

  public putFormatter(identifier: string, formatFunction: CodeFormatterFunction): void {
    if (identifier.length !== 1 || VALID_FORMATTER_CHARS.indexOf(identifier) < 0) {
      throw new Error("Invalid formatter identifier: " + identifier);
    }
    this.formatters.set(identifier, formatFunction);
  }

  public putInterceptor(interceptor: AnyInterceptor<T>): void {
    this.interceptors.push(interceptor);
  }

  public getInterceptors(forSection: CodeSection): AnyInterceptor<T>[] {
    const result: AnyInterceptor<T>[] = [];
    for (const interceptor of this.interceptors) {
      const type = interceptor.sectionType();
      if (type === null || forSection instanceof type) {
        if (interceptor.isIntercepted === undefined || interceptor.isIntercepted(forSection)) {
          result.push(interceptor);
        }
      }
    }
    return result;
  }

  private _appendText(text: string): void {
    this._checkIndentationBeforeWriting();
    this.builder.value += text;
  }

  private _checkIndentationBeforeWriting(): void {
    if (this.needsIndentation) {
      this.builder.value += this._leadingIndentString + this.newlinePrefix;
      this.needsIndentation = false;
    }
  }

  private _writeNewline(): void {
    this._checkIndentationBeforeWriting();
    this._trimSpaces();
    this.builder.value += this.newline;
    this.needsIndentation = true;
  }

  private _trimSpaces(): void {
    if (!this.trimTrailingSpaces) {
      return;
    }
    const value = this.builder.value;
    let toRemove = 0;
    for (let i = value.length - 1; i > 0; i--) {
      if (value.charCodeAt(i) === 32) {
        toRemove++;
      } else {
        break;
      }
    }
    if (toRemove > 0) {
      this.builder.value = value.slice(0, value.length - toRemove);
    }
  }
}

function CodeInterceptorByName<T extends AbstractCodeWriter<T>>(
  sectionName: string,
  consumer: (writer: T, previousText: string) => void
): AnyInterceptor<T> {
  return {
    sectionType: () => null,
    isIntercepted: (section: CodeSection) => section.sectionName() === sectionName,
    write: (writer: T, previousText: string) => consumer(writer, previousText),
  };
}

function findContextMethod(section: CodeSection, key: string): string | null {
  const getter = "get" + StringUtils.capitalize(key);
  for (const name of [key, getter]) {
    if (name !== "constructor" && typeof (section as any)[name] === "function") {
      return name;
    }
  }
  return null;
}
