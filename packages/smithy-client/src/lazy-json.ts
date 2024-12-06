/**
 * @internal
 *
 * This class allows the usage of data objects in fields that expect
 * JSON strings. It serializes the data object into JSON
 * if needed during the request serialization step.
 *
 */
export class LazyJsonString {
  private constructor(private value: string) {}

  public toString(): string {
    return this.value;
  }

  public valueOf(): string {
    return this.value;
  }

  public toJSON(): string {
    return this.value;
  }

  public static from(object: any): LazyJsonString {
    if (object instanceof LazyJsonString) {
      return object;
    } else if (typeof object === "string") {
      return new LazyJsonString(object);
    }
    return new LazyJsonString(JSON.stringify(object));
  }

  /**
   * @deprecated call from() instead.
   */
  public static fromObject(object: any): LazyJsonString {
    return LazyJsonString.from(object);
  }
}
