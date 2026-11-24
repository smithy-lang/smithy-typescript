import { StringUtils } from "./StringUtils";

const FIRST_SNAKE_PATTERN = /([A-Z]+)([A-Z][a-z])/g;
const SECOND_SNAKE_PATTERN = /([a-z\d])([A-Z])/g;
const SPACE_OR_DASH_PATTERN = /(\s|-)/g;

/**
 * Case conversion helpers ported from software.amazon.smithy.utils.CaseUtils.
 *
 * @internal
 */
export class CaseUtils {
  public static toCamelCase(
    value: string,
    capitalizeFirstLetter = false,
    delimiters: readonly string[] = ["_", "-", " "]
  ): string {
    if (StringUtils.isEmpty(value)) {
      return value;
    }
    const lowered = value.toLowerCase();
    const delimiterSet = new Set<string>(delimiters);
    delimiterSet.add(" ");
    const output: string[] = [];
    let capitalizeNext = capitalizeFirstLetter;
    for (const codePoint of Array.from(lowered)) {
      if (delimiterSet.has(codePoint)) {
        capitalizeNext = output.length !== 0;
      } else if (capitalizeNext || (output.length === 0 && capitalizeFirstLetter)) {
        output.push(StringUtils.toTitleCase(codePoint));
        capitalizeNext = false;
      } else {
        output.push(codePoint);
      }
    }
    return output.length !== 0 ? output.join("") : lowered;
  }

  public static toSnakeCase(value: string): string {
    if (StringUtils.isEmpty(value)) {
      return value;
    }
    return value
      .replace(FIRST_SNAKE_PATTERN, "$1_$2")
      .replace(SECOND_SNAKE_PATTERN, "$1_$2")
      .replace(SPACE_OR_DASH_PATTERN, "_")
      .toLowerCase();
  }
}
