import type { Schema as ISchema } from "@smithy/types";

export class TypeRegistry {
  public static active: TypeRegistry | null = null;
  public static registries = new Map<string, TypeRegistry>();
  public static schemaToRegistry = new Map<object, TypeRegistry>();

  private simpleTypes: Record<string, string> = {};

  private constructor(
    public readonly namespace: string,
    private schemas: Map<string, ISchema> = new Map()
  ) {}

  /**
   * @param namespace - specifier.
   * @returns the schema for that namespace, creating it if necessary.
   */
  public static for(namespace: string): TypeRegistry {
    if (!TypeRegistry.registries.has(namespace)) {
      TypeRegistry.registries.set(namespace, new TypeRegistry(namespace));
    }
    return TypeRegistry.registries.get(namespace)!;
  }

  /**
   * The active type registry's namespace is used.
   * @param shapeId - to be registered.
   * @param schema - to be registered.
   */
  public register(shapeId: string, schema: ISchema) {
    const qualifiedName = this.namespace + "#" + shapeId;
    this.schemas.set(qualifiedName, schema);
    if (typeof schema === "object") {
      TypeRegistry.schemaToRegistry.set(schema, this);
    }
  }

  /**
   * Used to disambiguate e.g. XML values, which are all strings,
   * into other simple JavaScript types like boolean and number.
   *
   * @param simpleTypes - map of shape id strings to simple type.
   */
  public registerSimpleTypes(simpleTypes: Record<string, "boolean" | "number" | "bigint" | "bigdecimal">): void {
    for (const [name, type] of Object.entries(simpleTypes)) {
      const normalizedName = name.includes("#") ? name : this.namespace + "#" + name;
      this.simpleTypes[normalizedName] = type;
    }
  }

  /**
   * Used to disambiguate e.g. XML values, which are all strings,
   * into other simple JavaScript types like boolean and number.
   *
   * @param shapeId - to query.
   * @returns simple type of the shape id in this registry.
   */
  public getSimpleType(shapeId: string): string {
    if (shapeId.includes("#")) {
      return this.simpleTypes[shapeId];
    }
    return this.simpleTypes[this.namespace + "#" + shapeId] ?? "unknown";
  }

  /**
   * @param shapeId - query.
   * @returns the schema.
   */
  public getSchema(shapeId: string): ISchema {
    if (shapeId.includes("#")) {
      return this.schemas.get(shapeId);
    }
    return this.schemas.get(this.namespace + "#" + shapeId);
  }

  /**
   * Schemas created between start and stop capture
   * will be associated with the active registry's namespace.
   */
  public startCapture() {
    TypeRegistry.active = this;
  }

  /**
   * @see #startCapture().
   */
  public stopCapture() {
    TypeRegistry.active = null;
  }

  public destroy() {
    TypeRegistry.registries.delete(this.namespace);
    this.schemas.clear();
  }
}
