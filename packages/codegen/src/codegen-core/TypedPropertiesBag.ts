/**
 * Holds string-keyed values for symbols, references and dependencies.
 */
export abstract class TypedPropertiesBag {
  private readonly _properties: Map<string, unknown>;

  protected constructor(builder: TypedPropertiesBagBuilder<any>) {
    this._properties = new Map(builder.properties);
  }

  public getProperties(): Map<string, unknown> {
    return this._properties;
  }

  public getProperty<T = unknown>(name: string): T | undefined {
    const value = this._properties.get(name);
    return value === null ? undefined : (value as T | undefined);
  }

  public expectProperty<T = unknown>(name: string): T {
    const value = this.getProperty<T>(name);
    if (value === undefined) {
      throw new Error(`Property \`${name}\` is not part of ${this.constructor.name}, \`${this}\``);
    }
    return value;
  }

  public equals(other: unknown): boolean {
    return other instanceof TypedPropertiesBag && mapsEqual(this._properties, other._properties);
  }
}

export abstract class TypedPropertiesBagBuilder<B extends TypedPropertiesBagBuilder<B>> {
  public properties = new Map<string, unknown>();

  public putProperty(key: string, value: unknown): B {
    this.properties.set(key, value);
    return this as unknown as B;
  }

  public setProperties(properties: Map<string, unknown> | Record<string, unknown>): B {
    this.properties = properties instanceof Map ? new Map(properties) : new Map(Object.entries(properties));
    return this as unknown as B;
  }
}

export function mapsEqual(a: Map<unknown, unknown>, b: Map<unknown, unknown>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [k, v] of a) {
    if (!b.has(k) || !valuesEqual(v, b.get(k))) {
      return false;
    }
  }
  return true;
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a === "object" && a !== null && typeof (a as { equals?: unknown }).equals === "function") {
    return (a as { equals(o: unknown): boolean }).equals(b);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => valuesEqual(v, b[i]));
  }
  return false;
}
