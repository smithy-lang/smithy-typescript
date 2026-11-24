import { isJsonObject, type JsonValue, printJson } from "./JsonValue";

/**
 * Alphabet available to the variable name generator, omitting "r" for other use.
 */
const ALPHABET = "abcdefghijklmnopqstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORD_ONLY_KEY = /"(\w+)":/g;
const SSA_PATTERN = /_ssa_(\d{1,2})/;
const SSA_PATTERN_GLOBAL = /_ssa_(\d{1,2})/g;

/**
 * Compresses a JSON object by extracting repeated patterns into reusable JavaScript variables.
 */
export class PatternDetectionCompression {
  private readonly _objectNode: { [key: string]: JsonValue };
  private readonly _varIdToBlock = new Map<number, string>();
  private readonly _blockToVarId = new Map<string, number>();
  private readonly _varIdToCount = new Map<number, number>();
  private readonly _pathToVarId = new Map<string, number>();
  private readonly _pathsSeen = new Set<string>();
  private readonly _variableIdsUsed = new Set<number>();
  private readonly _keyToVarId = new Map<string, number>();
  private readonly _writeReplacements = new Map<string, number>();
  private readonly _writeReplacementSsaNum = new Map<string, string>();
  private readonly _ssaTemplateNumbers = new Map<string, string[]>();
  private readonly _blockToSsaNormalized = new Map<string, string>();
  private _variableId = 0;
  private _varName: number[] = [0];
  private _mode: "read" | "write" = "read";

  public constructor(objectNode: { [key: string]: JsonValue }) {
    this._objectNode = objectNode;
  }

  public compress(): string {
    this._traverse(this._objectNode, "", null);

    this._mode = "write";
    this._traverse(this._objectNode, "", null);
    this._mode = "read";

    const replaced = this._applyReplacements(this._objectNode, "");

    let buffer = "const _data=" + stripWordOnlyKeyQuotes(printJson(replaced)) + ";";

    const orderedVariableIds = this._getOrderedVariableIds();

    const codeBlockBuffer: string[] = [];
    for (const variableIdVal of orderedVariableIds) {
      const symbol = this._nextVariableName();
      const block = this._varIdToBlock.get(variableIdVal) as string;

      if (this._ssaTemplateNumbers.has(block)) {
        const inner = block.substring(1, block.length - 1);
        const parts = inner.split("_ssa_");
        let templateBody = '"';
        for (let i = 0; i < parts.length; ++i) {
          if (i > 0) {
            templateBody += '_ssa_"+n+"';
          }
          templateBody += parts[i];
        }
        templateBody += '"';
        codeBlockBuffer.push(symbol + "=(n: number)=>" + templateBody);

        const ssaPlaceholder = new RegExp('"__REPLACE__' + variableIdVal + '__SSA__(\\d{1,2})__REPLACE__"', "g");
        buffer = buffer.replace(ssaPlaceholder, (_m, group: string) => symbol + "(" + group + ")");
      } else {
        codeBlockBuffer.push(symbol + "=" + block);
      }

      buffer = buffer.split('"__REPLACE__' + variableIdVal + '__REPLACE__"').join(symbol);
    }

    for (let i = 0; i < codeBlockBuffer.length; ++i) {
      const iIndex = codeBlockBuffer[i].indexOf("=");
      const iSymbol = codeBlockBuffer[i].substring(0, iIndex);
      const iCode = codeBlockBuffer[i].substring(iIndex + 1);

      for (let j = i + 1; j < codeBlockBuffer.length; ++j) {
        const jIndex = codeBlockBuffer[j].indexOf("=");
        const jCode = codeBlockBuffer[j].substring(jIndex + 1);

        if (jCode.includes(iCode)) {
          if (iCode.charAt(0) !== '"' && iCode.length < 6) {
            continue;
          }

          const keyPattern = new RegExp(escapeRegExp(iCode) + ":([^ ])", "g");
          codeBlockBuffer[j] = codeBlockBuffer[j].replace(keyPattern, (_m, g: string) => "[" + iSymbol + "]:" + g);
          codeBlockBuffer[j] = codeBlockBuffer[j].split(iCode).join(iSymbol);
        }
      }
    }

    if (codeBlockBuffer.length > 0) {
      buffer = "const " + codeBlockBuffer.join(",\n") + ";\n" + buffer;
    }

    const keyVarBuffer: string[] = [];
    for (const key of this._keyToVarId.keys()) {
      const count = buffer.split('"' + key + '":').length - 1;

      if (count > 1 && key.length * count > 8) {
        const symbol = this._nextVariableName();
        keyVarBuffer.push(symbol + '="' + key + '"');
        const pattern = new RegExp('"?' + escapeRegExp(key) + '"?:([^ ])', "g");
        buffer = buffer.replace(pattern, (_m, g: string) => "[" + symbol + "]:" + g);
      }
    }
    if (keyVarBuffer.length > 0) {
      buffer = "const " + keyVarBuffer.join(",\n") + ";\n" + buffer;
    }

    buffer = prettyPrintData(buffer);
    buffer += "\n";

    return buffer;
  }

  private _nextVariableName(): string {
    let out = "";
    for (let i = this._varName.length - 1; i >= 0; --i) {
      out += ALPHABET.charAt(this._varName[i]);
    }

    let carry = false;
    for (let i = 0; i < this._varName.length; ++i) {
      const n = this._varName[i];
      if (n >= ALPHABET.length - 1) {
        this._varName[i] = 0;
        carry = true;
        continue;
      }
      if (carry) {
        this._varName[i] += 1;
        carry = false;
      } else {
        this._varName[i] += 1;
        break;
      }
    }
    if (carry) {
      this._varName = [...this._varName, 0];
    }
    return out;
  }

  private _traverse(node: JsonValue, path: string, key: string | null): void {
    const optionalReplace = this._mode === "read" ? this._read(node, path, key) : this._write(node);
    if (optionalReplace !== null) {
      this._variableIdsUsed.add(optionalReplace);
      this._writeReplacements.set(path, optionalReplace);
      if (typeof node === "string") {
        const block = printJson(node);
        if (this._blockToSsaNormalized.has(block)) {
          const m = SSA_PATTERN.exec(block);
          if (m !== null) {
            this._writeReplacementSsaNum.set(path, m[1]);
          }
        }
      }
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; ++i) {
        this._traverse(node[i], path + "[" + i + "]", null);
      }
    } else if (isJsonObject(node)) {
      for (const k of Object.keys(node)) {
        this._traverse(node[k], path + "[`" + k + "`]", k);
      }
    }
  }

  private _read(node: JsonValue, path: string, key: string | null): number | null {
    const block = printJson(node);
    if (this._pathsSeen.has(path)) {
      throw new Error("already seen: " + path);
    }
    this._pathsSeen.add(path);

    if (key !== null) {
      const varId = this._variableId++;
      this._keyToVarId.set(key, varId);
      this._varIdToBlock.set(varId, key);
    }

    let lookupBlock = block;
    if (typeof node === "string") {
      const ssaM = SSA_PATTERN.exec(block);
      if (ssaM !== null) {
        const normalized = block.replace(SSA_PATTERN_GLOBAL, "_ssa_");
        lookupBlock = normalized;
        this._blockToSsaNormalized.set(block, normalized);
        let numbers = this._ssaTemplateNumbers.get(normalized);
        if (numbers === undefined) {
          numbers = [];
          this._ssaTemplateNumbers.set(normalized, numbers);
        }
        numbers.push(ssaM[1]);
      }
    }

    const existing = this._blockToVarId.get(lookupBlock);
    if (existing !== undefined) {
      this._varIdToCount.set(existing, (this._varIdToCount.get(existing) as number) + 1);
    } else {
      const varId = this._variableId++;
      this._blockToVarId.set(lookupBlock, varId);
      this._varIdToBlock.set(varId, lookupBlock);
      this._varIdToCount.set(varId, 1);
      this._pathToVarId.set(path, varId);
    }
    return null;
  }

  private _write(node: JsonValue): number | null {
    const block = printJson(node);
    const lookupBlock = this._blockToSsaNormalized.get(block) ?? block;

    const variable = this._blockToVarId.get(lookupBlock);
    if (variable !== undefined) {
      const count = this._varIdToCount.get(variable) as number;
      if (count >= 2 && lookupBlock.length * count >= 10) {
        return variable;
      }
    }
    return null;
  }

  private _applyReplacements(node: JsonValue, path: string): JsonValue {
    const varId = this._writeReplacements.get(path);
    if (varId !== undefined) {
      const ssaNum = this._writeReplacementSsaNum.get(path);
      if (ssaNum !== undefined) {
        return "__REPLACE__" + varId + "__SSA__" + ssaNum + "__REPLACE__";
      }
      return "__REPLACE__" + varId + "__REPLACE__";
    }

    if (Array.isArray(node)) {
      return node.map((element, i) => this._applyReplacements(element, path + "[" + i + "]"));
    } else if (isJsonObject(node)) {
      const result: { [key: string]: JsonValue } = {};
      for (const k of Object.keys(node)) {
        result[k] = this._applyReplacements(node[k], path + "[`" + k + "`]");
      }
      return result;
    }
    return node;
  }

  private _getOrderedVariableIds(): number[] {
    const orderedVariableIds = Array.from(this._variableIdsUsed);
    const boolStartChar = "b";
    orderedVariableIds.sort((a, b) => {
      let aStartChar = (this._varIdToBlock.get(a) as string).charAt(0);
      let bStartChar = (this._varIdToBlock.get(b) as string).charAt(0);

      if (aStartChar === "t" || aStartChar === "f") {
        aStartChar = boolStartChar;
      }
      if (bStartChar === "t" || bStartChar === "f") {
        bStartChar = boolStartChar;
      }

      if (aStartChar === bStartChar) {
        return 0;
      }

      for (const startChar of ["[", "{", '"', boolStartChar]) {
        if (aStartChar === startChar) {
          return 1;
        } else if (bStartChar === startChar) {
          return -1;
        }
      }

      throw new Error("unexpected start char: " + aStartChar + ", " + bStartChar);
    });
    return orderedVariableIds;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripWordOnlyKeyQuotes(json: string): string {
  return json.replace(WORD_ONLY_KEY, "$1:");
}

function skipString(s: string, i: number): number {
  i += 1;
  while (i < s.length && s.charAt(i) !== '"') {
    if (s.charAt(i) === "\\") {
      i += 1;
    }
    i += 1;
  }
  return i;
}

function prettyPrintData(buffer: string): string {
  const dataStart = buffer.indexOf("const _data=");
  if (dataStart < 0) {
    return buffer;
  }

  const objectLiteralStart = buffer.indexOf("{", dataStart);

  let depth = 0;
  let objectLiteralEnd = -1;

  for (let i = objectLiteralStart; i < buffer.length; ++i) {
    const c = buffer.charAt(i);
    if (c === '"') {
      i = skipString(buffer, i);
    } else if (c === "{" || c === "[" || c === "(") {
      depth += 1;
    } else if (c === "}" || c === "]" || c === ")") {
      depth -= 1;
      if (depth === 0) {
        objectLiteralEnd = i;
        break;
      }
    }
  }

  if (objectLiteralEnd < 0) {
    return buffer;
  }

  const inner = buffer.substring(objectLiteralStart + 1, objectLiteralEnd);
  let b = buffer.substring(0, objectLiteralStart) + "{\n";

  const topEntries = splitAtDepthZero(inner);
  for (let i = 0; i < topEntries.length; ++i) {
    const entry = topEntries[i];
    const colonPos = findDepthZeroColon(entry);
    if (colonPos < 0) {
      b += "  " + entry.trim();
    } else {
      const key = entry.substring(0, colonPos + 1).trim();
      const value = entry.substring(colonPos + 1).trim();
      if (value.startsWith("[")) {
        const arrayContent = value.substring(1, value.length - 1);
        const items = splitAtDepthZero(arrayContent);
        b += "  " + key + " [\n";
        for (let j = 0; j < items.length; ++j) {
          b += "    " + items[j].trim();
          if (j < items.length - 1) {
            b += ",";
          }
          b += "\n";
        }
        b += "  ]";
      } else {
        b += "  " + key + " " + value;
      }
    }
    if (i < topEntries.length - 1) {
      b += ",";
    }
    b += "\n";
  }

  return b + "}" + buffer.substring(objectLiteralEnd + 1);
}

function splitAtDepthZero(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; ++i) {
    const c = s.charAt(i);
    if (c === '"') {
      i = skipString(s, i);
    } else if (c === "{" || c === "[" || c === "(") {
      depth += 1;
    } else if (c === "}" || c === "]" || c === ")") {
      depth -= 1;
    } else if (c === "," && depth === 0) {
      parts.push(s.substring(start, i));
      start = i + 1;
    }
  }
  if (start < s.length) {
    parts.push(s.substring(start));
  }
  return parts;
}

function findDepthZeroColon(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; ++i) {
    const c = s.charAt(i);
    if (c === '"') {
      i = skipString(s, i);
    } else if (c === "{" || c === "[" || c === "(") {
      depth += 1;
    } else if (c === "}" || c === "]" || c === ")") {
      depth -= 1;
    } else if (c === ":" && depth === 0) {
      return i;
    }
  }
  return -1;
}
