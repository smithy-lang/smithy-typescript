/**
 * Builds property accessors that are valid for any property name.
 *
 * @internal
 */
export class PropertyAccessor {
  public static readonly VALID_JAVASCRIPT_PROPERTY_NAME = /^(?![0-9])[a-zA-Z0-9$_]+$/;

  private constructor() {}

  public static getPropertyAccessor(propertyName: string): string {
    if (PropertyAccessor.VALID_JAVASCRIPT_PROPERTY_NAME.test(propertyName)) {
      return "." + propertyName;
    }
    if (propertyName.includes('"')) {
      return "[`" + propertyName + "`]";
    }
    return '["' + propertyName + '"]';
  }

  public static inlineKey(propertyName: string): string {
    if (PropertyAccessor.VALID_JAVASCRIPT_PROPERTY_NAME.test(propertyName)) {
      return propertyName;
    }
    if (propertyName.includes('"')) {
      return "[`" + propertyName.split("`").join("\\\\`") + "`]";
    }
    return '"' + propertyName.split("`").join("\\\\`") + '"';
  }

  public static getFrom(variable: string, propertyName: string): string {
    return variable + PropertyAccessor.getPropertyAccessor(propertyName);
  }
}
