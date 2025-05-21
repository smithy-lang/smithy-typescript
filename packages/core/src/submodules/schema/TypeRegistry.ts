import type { Schema as ISchema } from "@smithy/types";

import { ErrorSchema } from "./schemas/ErrorSchema";

/**
 * A way to look up schema by their ShapeId values.
 *
 * @alpha
 */
export class TypeRegistry {
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
   * Adds the given schema to a type registry with the same namespace.
   *
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

  /**
   * The smithy-typescript code generator generates a synthetic (i.e. unmodeled) base exception,
   * because generated SDKs before the introduction of schemas have the notion of a ServiceBaseException, which
   * is unique per service/model.
   *
   * This is generated under a unique prefix that is combined with the service namespace, and this
   * method is used to retrieve it.
   *
   * The base exception synthetic schema is used when an error is returned by a service, but we cannot
   * determine what existing schema to use to deserialize it.
   *
   * @returns the synthetic base exception of the service namespace associated with this registry instance.
   */
  public getBaseException(): ErrorSchema | undefined {
    for (const [id, schema] of this.schemas.entries()) {
      if (id.startsWith("smithyts.client.synthetic.") && id.endsWith("ServiceException")) {
        return schema as ErrorSchema;
      }
    }
    return undefined;
  }

  /**
   * @param predicate - criterion.
   * @returns a schema in this registry matching the predicate.
   */
  public find(predicate: (schema: ISchema) => boolean) {
    return [...this.schemas.values()].find(predicate);
  }

  /**
   * Unloads the current TypeRegistry.
   */
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
