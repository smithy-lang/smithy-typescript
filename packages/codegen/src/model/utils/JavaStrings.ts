/**
 * Helpers that reproduce java.lang.String behaviors the Smithy library depends on.
 */
export class JavaStrings {
  /**
   * Splits like String.split(regex-free separator), dropping trailing empty strings.
   */
  public static split(value: string, separator: string, limit = 0): string[] {
    const parts: string[] = [];
    let start = 0;
    while (limit <= 0 || parts.length < limit - 1) {
      const index = value.indexOf(separator, start);
      if (index === -1) {
        break;
      }
      parts.push(value.substring(start, index));
      start = index + separator.length;
    }
    parts.push(value.substring(start));
    if (limit === 0) {
      while (parts.length > 0 && parts[parts.length - 1].length === 0) {
        parts.pop();
      }
    }
    return parts;
  }

  /**
   * Mirrors String.compareToIgnoreCase.
   */
  public static compareToIgnoreCase(left: string, right: string): number {
    const length = Math.min(left.length, right.length);
    for (let i = 0; i < length; i++) {
      let a = left.charCodeAt(i);
      let b = right.charCodeAt(i);
      if (a !== b) {
        a = JavaStrings._fold(a);
        b = JavaStrings._fold(b);
        if (a !== b) {
          return a - b;
        }
      }
    }
    return left.length - right.length;
  }

  /**
   * Mirrors String.compareTo.
   */
  public static compare(left: string, right: string): number {
    const length = Math.min(left.length, right.length);
    for (let i = 0; i < length; i++) {
      const diff = left.charCodeAt(i) - right.charCodeAt(i);
      if (diff !== 0) {
        return diff;
      }
    }
    return left.length - right.length;
  }

  private static _fold(code: number): number {
    const upper = String.fromCharCode(code).toUpperCase();
    const folded = upper.length === 1 ? upper.toLowerCase() : String.fromCharCode(code).toLowerCase();
    return folded.length === 1 ? folded.charCodeAt(0) : code;
  }
}
