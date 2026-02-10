import type { Schema as ISchema, StaticErrorSchema } from "@smithy/types";

import type { ErrorSchema } from "./schemas/ErrorSchema";

/**
 * A way to look up schema by their ShapeId values.
 *
 * @public
 */
export class TypeRegistry {
  public static readonly registries = new Map<string, TypeRegistry>();

  private constructor(
    public readonly namespace: string,
    private schemas: Map<string, ISchema> = new Map(),
    private exceptions: Map<StaticErrorSchema, any> = new Map()
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
   * Copies entries from another instance without changing the namespace of self.
   * The composition is additive but non-destructive and will not overwrite existing entries.
   *
   * @param other - another TypeRegistry.
   */
  public copyFrom(other: TypeRegistry) {
    const { schemas, exceptions } = this;
    for (const [k, v] of other.schemas) {
      if (!schemas.has(k)) {
        schemas.set(k, v);
      }
    }
    for (const [k, v] of other.exceptions) {
      if (!exceptions.has(k)) {
        exceptions.set(k, v);
      }
    }
  }

  /**
   * Adds the given schema to a type registry with the same namespace, and this registry.
   *
   * @param shapeId - to be registered.
   * @param schema - to be registered.
   */
  public register(shapeId: string, schema: ISchema) {
    const qualifiedName = this.normalizeShapeId(shapeId);
    for (const r of [this, TypeRegistry.for(qualifiedName.split("#")[0])]) {
      r.schemas.set(qualifiedName, schema);
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
   * Associates an error schema with its constructor.
   */
  public registerError(es: ErrorSchema | StaticErrorSchema, ctor: any) {
    const $error = es as StaticErrorSchema;
    const ns = $error[1];
    for (const r of [this, TypeRegistry.for(ns)]) {
      r.schemas.set(ns + "#" + $error[2], $error);
      r.exceptions.set($error, ctor);
    }
  }

  /**
   * @param es - query.
   * @returns Error constructor that extends the service's base exception.
   */
  public getErrorCtor(es: ErrorSchema | StaticErrorSchema): any {
    const $error = es as StaticErrorSchema;
    if (this.exceptions.has($error)) {
      return this.exceptions.get($error);
    }
    const registry = TypeRegistry.for($error[1]);
    return registry.exceptions.get($error);
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
  public getBaseException(): StaticErrorSchema | undefined {
    for (const exceptionKey of this.exceptions.keys()) {
      if (Array.isArray(exceptionKey)) {
        const [, ns, name] = exceptionKey;
        const id = ns + "#" + name;
        if (id.startsWith("smithy.ts.sdk.synthetic.") && id.endsWith("ServiceException")) {
          return exceptionKey;
        }
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
  public clear() {
    this.schemas.clear();
    this.exceptions.clear();
  }

  private normalizeShapeId(shapeId: string) {
    if (shapeId.includes("#")) {
      return shapeId;
    }
    return this.namespace + "#" + shapeId;
  }
}
