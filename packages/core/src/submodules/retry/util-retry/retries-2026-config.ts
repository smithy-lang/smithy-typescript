import type {
  DEFAULT_RETRY_DELAY_BASE,
  RETRY_COST,
  THROTTLING_RETRY_DELAY_BASE,
  TIMEOUT_RETRY_COST,
} from "./constants";

/**
 * @internal
 */
export abstract class Retry {
  public static v2026 = typeof process !== "undefined" && process.env?.SMITHY_NEW_RETRIES_2026 === "true";

  public static delay() {
    return Retry.v2026 ? 50 : (100 satisfies typeof DEFAULT_RETRY_DELAY_BASE);
  }

  public static throttlingDelay() {
    return Retry.v2026 ? 1_000 : (500 satisfies typeof THROTTLING_RETRY_DELAY_BASE);
  }

  public static cost() {
    return Retry.v2026 ? 14 : (5 satisfies typeof RETRY_COST);
  }

  public static throttlingCost() {
    return Retry.v2026 ? 5 : (10 satisfies typeof TIMEOUT_RETRY_COST);
  }

  public static modifiedCostType() {
    return Retry.v2026 ? "THROTTLING" : "TRANSIENT";
  }
}
