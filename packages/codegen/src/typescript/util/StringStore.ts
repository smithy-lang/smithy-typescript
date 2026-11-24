import { StringUtils } from "../../codegen-core";
import { TreeMap } from "../../model";

/**
 * Allocates and tracks variables assigned to string literals, compressing long protocol serde files.
 */
export class StringStore {
  private readonly _literalToVariable = new Map<string, string>();
  private readonly _variableToLiteral = new TreeMap<string, string>();
  private readonly _writeLog = new Set<string>();

  public var(literal: string, preferredPrefix?: string): string {
    if (literal === null || literal === undefined) {
      throw new TypeError("literal must not be null");
    }
    let variable = this._literalToVariable.get(literal);
    if (variable === undefined) {
      variable =
        preferredPrefix === undefined ? this._assignKey(literal) : this._assignPreferredKey(literal, preferredPrefix);
      this._literalToVariable.set(literal, variable);
    }
    return variable;
  }

  public flushVariableDeclarationCode(): string {
    let sourceCode = "";
    for (const variable of this._variableToLiteral.keys()) {
      if (!this._writeLog.has(variable)) {
        this._writeLog.add(variable);
        const literal = this._variableToLiteral.get(variable) as string;
        sourceCode += `const ${variable} = ${StringUtils.escapeJavaString(literal, "")};\n`;
      }
    }
    return sourceCode;
  }

  private _assignKey(literal: string): string {
    const variable = this._allocateVariable(literal);
    this._variableToLiteral.set(variable, literal);
    return variable;
  }

  private _assignPreferredKey(literal: string, preferredPrefix: string): string {
    let numericSuffix = 0;
    let candidate = preferredPrefix + numericSuffix;
    while (this._variableToLiteral.has(candidate)) {
      numericSuffix += 1;
      candidate = preferredPrefix + numericSuffix;
    }
    this._variableToLiteral.set(candidate, literal);
    return candidate;
  }

  private _allocateVariable(literal: string): string {
    const sections = literal.split(/[-_\s]/).filter((s) => s.length > 0);
    let v = "_";
    const deconfliction: string[] = [];
    if (sections.length > 1) {
      for (const s of sections) {
        const c = s.charAt(0);
        if (isAllowedChar(c)) {
          v += c;
        }
      }
    } else {
      for (let i = 0; i < literal.length; i++) {
        const c = literal.charAt(i);
        if ((c >= "A" && c <= "Z") || (isNeutral(v) && isAllowedChar(c))) {
          v += c;
        } else if (isAllowedChar(c)) {
          deconfliction.push(c);
        }
      }
    }
    if (v.length === 0) {
      v += "v";
    }
    let next = 0;
    while (this._variableToLiteral.has(v)) {
      if (next < deconfliction.length) {
        v += deconfliction[next++];
      } else {
        v += "_";
      }
    }
    return v;
  }
}

function isAllowedChar(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

function isNeutral(variable: string): boolean {
  for (let i = 0; i < variable.length; i++) {
    if (variable.charAt(i) !== "_") {
      return false;
    }
  }
  return true;
}
