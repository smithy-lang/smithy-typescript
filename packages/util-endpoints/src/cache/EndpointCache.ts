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
   * @param [params] - list of params to consider as part of the cache key.
   *
   * If the params list is not populated, all object keys will be considered.
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

  private hash(endpointParams: EndpointParams): string {
    let buffer = "";
    const params = this.parameters.length ? this.parameters : Object.keys(endpointParams);
    for (const param of params) {
      buffer += endpointParams[param] ?? "" + "|";
    }
    return buffer;
  }
}
