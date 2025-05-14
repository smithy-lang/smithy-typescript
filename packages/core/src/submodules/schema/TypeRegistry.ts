import type { Schema as ISchema } from "@smithy/types";

import { ErrorSchema } from "./schemas/ErrorSchema";

/**
 * A way to look up schema by their ShapeId values.
 *
 * @public
 */
export class TypeRegistry {
  public static active: TypeRegistry | null = null;
  public static readonly registries = new Map<string, TypeRegistry>();

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
    const registry = TypeRegistry.for(this.getNamespace(shapeId));
    registry.schemas.set(qualifiedName, schema);
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

  public getBaseException(): ErrorSchema | undefined {
    for (const [id, schema] of this.schemas.entries()) {
      if (id.startsWith("smithyts.client.synthetic.") && id.endsWith("ServiceException")) {
        return schema as ErrorSchema;
      }
    }
    return undefined;
  }

  public find(seeker: (schema: ISchema) => boolean) {
    return [...this.schemas.values()].find(seeker);
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

  private getNamespace(shapeId: string) {
    return this.normalizeShapeId(shapeId).split("#")[0];
  }
}
