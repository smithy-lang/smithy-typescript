import type { Schema as ISchema } from "@smithy/types";

export class TypeRegistry {
  public static active: TypeRegistry | null = null;
  public static registries = new Map<string, TypeRegistry>();
  public static schemaToRegistry = new Map<object, TypeRegistry>();

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
    const qualifiedName = this.normalizeShapeId(shapeId);
    this.schemas.set(qualifiedName, schema);
    if (typeof schema === "object") {
      TypeRegistry.schemaToRegistry.set(schema, this);
    }
  }

  /**
   * @param shapeId - query.
   * @returns the schema.
   */
  public getSchema(shapeId: string): ISchema {
    const id = this.normalizeShapeId(shapeId);
    if (!this.schemas.has(id)) {
      throw new Error(`@smithy/core/schema - schema not found for ${id}`);
    }
    return this.schemas.get(id)!;
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

  private normalizeShapeId(shapeId: string) {
    if (shapeId.includes("#")) {
      return shapeId;
    }
    return this.namespace + "#" + shapeId;
  }
}
