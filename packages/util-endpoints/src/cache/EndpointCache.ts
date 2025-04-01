import type { EndpointParams, EndpointV2 } from "@smithy/types";

/**
 * @internal
 *
 * Cache for endpoint ruleSet resolution.
 */
export class EndpointCache {
  private capacity: number;
  private data = new Map<string, EndpointV2>();
  private parameters: string[] = [];

  /**
   * @param [size] - desired average maximum capacity. A buffer of 10 additional keys will be allowed
   *                 before keys are dropped.
   * @param [params] - list of params to consider as part of the cache key.
   *
   * If the params list is not populated, no caching will happen.
   * This may be out of order depending on how the object is created and arrives to this class.
   */
  public constructor({ size, params }: { size?: number; params?: string[] }) {
    this.capacity = size ?? 50;
    if (params) {
      this.parameters = params;
    }
  }

  /**
   * @param endpointParams - query for endpoint.
   * @param resolver - provider of the value if not present.
   * @returns endpoint corresponding to the query.
   */
  public get(endpointParams: EndpointParams, resolver: () => EndpointV2): EndpointV2 {
    const key = this.hash(endpointParams);
    if (key === false) {
      return resolver();
    }

    if (!this.data.has(key)) {
      if (this.data.size > this.capacity + 10) {
        const keys = this.data.keys();
        let i = 0;
        while (true) {
          const { value, done } = keys.next();
          this.data.delete(value);
          if (done || ++i > 10) {
            break;
          }
        }
      }
      this.data.set(key, resolver());
    }
    return this.data.get(key)!;
  }

  public size() {
    return this.data.size;
  }

  /**
   * @returns cache key or false if not cachable.
   */
  private hash(endpointParams: EndpointParams): string | false {
    let buffer = "";
    const { parameters } = this;
    if (parameters.length === 0) {
      return false;
    }
    for (const param of parameters) {
      const val = String(endpointParams[param] ?? "");
      if (val.includes("|;")) {
        return false;
      }
      buffer += val + "|;";
    }
    return buffer;
  }
}
