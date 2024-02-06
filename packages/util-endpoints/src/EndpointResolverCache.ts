import type { EndpointParams, EndpointV2, RuleSetObject } from "@smithy/types";

/**
 * @internal
 *
 * Used by the resolveEndpoint function.
 */
export class EndpointResolverCache {
  private static rulesetMap = new Map<RuleSetObject, EndpointResolverCache>();
  private store = new Map<string, EndpointV2>();

  public constructor(
    /**
     * Desired maximum number of entries in the cache.
     */
    public capacity: number = 100
  ) {}

  /**
   * @returns the instance associated with a particular ruleset object.
   */
  public static forRuleset(ruleset: RuleSetObject): EndpointResolverCache {
    if (!EndpointResolverCache.rulesetMap.get(ruleset)) {
      EndpointResolverCache.rulesetMap.set(ruleset, new EndpointResolverCache());
    }
    return EndpointResolverCache.rulesetMap.get(ruleset)!;
  }

  /**
   * Clear all registered instances and their caches.
   */
  public static clearAll(): void {
    for (const [, cache] of EndpointResolverCache.rulesetMap) {
      cache.clear();
    }
    EndpointResolverCache.rulesetMap.clear();
  }

  /**
   * Create a cache key.
   */
  public key(endpointParams: EndpointParams): string {
    let buffer = "";
    for (const key in endpointParams) {
      buffer += key;
      buffer += `=(${typeof endpointParams[key]})`;
      buffer += endpointParams[key];
      buffer += ",";
    }
    return buffer;
  }

  /**
   * Read from the cache.
   */
  public get(key: string): EndpointV2 | undefined {
    return this.store.get(key);
  }

  /**
   * Write to the cache.
   */
  public set(key: string, endpoint: EndpointV2): void {
    this.store.set(key, endpoint);
    this.trim();
  }

  /**
   * Remove items from the cache until capacity is
   * within the limit.
   */
  public trim(): void {
    if (this.store.size <= this.capacity) {
      return;
    }
    for (const [key] of this.store) {
      this.store.delete(key);
      if (this.store.size <= this.capacity) {
        return;
      }
    }
  }

  /**
   * Clear the cache.
   */
  public clear(): void {
    this.store.clear();
  }
}
