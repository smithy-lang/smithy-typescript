/**
 * Port of the subset of software.amazon.smithy.utils.StringUtils used by code writers.
 *
 * @internal
 */
export class StringUtils {
  public static isWhitespace(code: number): boolean {
    if (code <= 0x20) {
      return code === 0x20 || (code >= 0x09 && code <= 0x0d) || (code >= 0x1c && code <= 0x1f);
    }
    if (code < 0x1680) {
      return false;
    }
    return (
      code === 0x1680 ||
      (code >= 0x2000 && code <= 0x2006) ||
      (code >= 0x2008 && code <= 0x200a) ||
      code === 0x2028 ||
      code === 0x2029 ||
      code === 0x205f ||
      code === 0x3000
    );
  }

  public static isBlank(cs: string | null | undefined, start = 0, end?: number): boolean {
    if (cs == null) {
      return true;
    }
    const to = end === undefined ? cs.length : end;
    for (let i = start; i < to; i++) {
      if (!StringUtils.isWhitespace(cs.charCodeAt(i))) {
        return false;
      }
    }
    return true;
  }

  public static escapeJavaString(object: unknown, _indent = ""): string {
    const value = String(object);
    let result = '"';
    let runStart = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      let replacement: string | undefined;
      switch (c) {
        case 0x22:
          replacement = '\\"';
          break;
        case 0x08:
          replacement = "\\b";
          break;
        case 0x09:
          replacement = "\\t";
          break;
        case 0x0a:
          replacement = "\\n";
          break;
        case 0x0c:
          replacement = "\\f";
          break;
        case 0x0d:
          replacement = "\\r";
          break;
        case 0x5c:
          replacement = "\\\\";
          break;
        default:
          if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) {
            replacement = "\\u" + c.toString(16).padStart(4, "0");
          }
      }
      if (replacement !== undefined) {
        result += value.slice(runStart, i) + replacement;
        runStart = i + 1;
      }
    }
    return result + value.slice(runStart) + '"';
  }

  public static repeat(str: string, count: number): string {
    return count <= 0 ? "" : str.repeat(count);
  }

  public static stripEnd(str: string, stripChars: string | null): string {
    let end = str.length;
    if (end === 0) {
      return str;
    }
    if (stripChars === null) {
      while (end !== 0 && StringUtils.isWhitespace(str.charCodeAt(end - 1))) {
        end--;
      }
    } else if (stripChars.length === 0) {
      return str;
    } else {
      while (end !== 0 && stripChars.indexOf(str.charAt(end - 1)) !== -1) {
        end--;
      }
    }
    return end === str.length ? str : str.slice(0, end);
  }

  public static stripStart(str: string, stripChars: string | null): string {
    const len = str.length;
    if (len === 0) {
      return str;
    }
    let start = 0;
    if (stripChars === null) {
      while (start !== len && StringUtils.isWhitespace(str.charCodeAt(start))) {
        start++;
      }
    } else if (stripChars.length === 0) {
      return str;
    } else {
      while (start !== len && stripChars.indexOf(str.charAt(start)) !== -1) {
        start++;
      }
    }
    return str.slice(start);
  }

  public static strip(str: string, stripChars: string | null): string {
    return StringUtils.stripEnd(StringUtils.stripStart(str, stripChars), stripChars);
  }

  public static capitalize(str: string): string {
    return str.length === 0 ? str : str.charAt(0).toUpperCase() + str.slice(1);
  }
}
