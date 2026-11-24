/**
 * String helpers ported from software.amazon.smithy.utils.StringUtils.
 */
export class StringUtils {
  public static isEmpty(value: string | null | undefined): boolean {
    return value === null || value === undefined || value.length === 0;
  }

  public static capitalize(value: string): string {
    return StringUtils._changeFirst(value, true);
  }

  public static uncapitalize(value: string): string {
    return StringUtils._changeFirst(value, false);
  }

  /**
   * Quotes and escapes a value the way Smithy's CodeWriter does for string literals.
   */
  public static escapeJavaString(value: unknown, _indent: string | null = null): string {
    const text = String(value);
    const result: string[] = ['"'];
    for (let i = 0; i < text.length; i++) {
      const c = text.charAt(i);
      switch (c) {
        case '"':
          result.push('\\"');
          break;
        case "\b":
          result.push("\\b");
          break;
        case "\t":
          result.push("\\t");
          break;
        case "\n":
          result.push("\\n");
          break;
        case "\f":
          result.push("\\f");
          break;
        case "\r":
          result.push("\\r");
          break;
        case "\\":
          result.push("\\\\");
          break;
        default: {
          const code = c.charCodeAt(0);
          if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
            result.push("\\u" + ("0000" + code.toString(16)).slice(-4));
          } else {
            result.push(c);
          }
        }
      }
    }
    result.push('"');
    return result.join("");
  }

  /**
   * Mirrors java.lang.Character.toTitleCase for a single code point.
   */
  public static toTitleCase(codePoint: string): string {
    const upper = codePoint.toUpperCase();
    return Array.from(upper).length === 1 ? upper : codePoint;
  }

  private static _changeFirst(value: string, upper: boolean): string {
    if (value === null || value === undefined || value.length === 0) {
      return value;
    }
    const first = String.fromCodePoint(value.codePointAt(0) as number);
    const changed = upper ? StringUtils.toTitleCase(first) : first.toLowerCase();
    if (changed === first || Array.from(changed).length !== 1) {
      return value;
    }
    return changed + value.substring(first.length);
  }
}
