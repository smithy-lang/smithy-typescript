/**
 * Computes extension data for a schema-like object.
 *
 * @internal
 */
export interface SchemaExtensionProvider<Schema extends object, Extension> {
  provide(schema: Schema): Extension;
}

/**
 * Lazily computes and caches derived data on schema-like objects.
 *
 * Each key owns a unique symbol, so extension lookup is a direct property read
 * after the first access. Non-extensible schema objects fall back to a WeakMap.
 *
 * @internal
 */
export class SchemaExtensionKey<Schema extends object, Extension> {
  private readonly cacheKey = Symbol();
  private readonly fallback = new WeakMap<object, Extension>();

  public constructor(private readonly provider: SchemaExtensionProvider<Schema, Extension>) {}

  public get(schema: Schema, cacheOwner: object = schema): Extension {
    const cache = cacheOwner as Record<symbol, Extension>;
    if (Object.prototype.hasOwnProperty.call(cache, this.cacheKey)) {
      return cache[this.cacheKey];
    }
    if (this.fallback.has(cacheOwner)) {
      return this.fallback.get(cacheOwner)!;
    }

    const extension = this.provider.provide(schema);
    if (Object.isExtensible(cacheOwner)) {
      Object.defineProperty(cacheOwner, this.cacheKey, {
        value: extension,
      });
    } else {
      this.fallback.set(cacheOwner, extension);
    }
    return extension;
  }
}
