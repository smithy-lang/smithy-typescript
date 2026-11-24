import { StringUtils } from "../codegen-core";
import { RESOURCES } from "./TypeScriptResources";

const PROPERTY_NAME_REGEX = /^(?![0-9])[a-zA-Z0-9$_]+$/;
/**
 * Utility methods for TypeScript and JavaScript.
 */
export class TypeScriptUtils {
  private constructor() {}

  public static sanitizePropertyName(memberName: string): string {
    return PROPERTY_NAME_REGEX.test(memberName) ? memberName : StringUtils.escapeJavaString(memberName, "");
  }

  public static getEnumVariants(values: Iterable<string>): string {
    return Array.from(values)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((value) => StringUtils.escapeJavaString(value, ""))
      .join(" | ");
  }

  public static loadResourceAsString(name: string): string {
    const resource = RESOURCES[name];
    if (resource === undefined) {
      throw new Error("Unknown resource: " + name);
    }
    return resource;
  }
}
