/**
 * Retry parameters used by the standard retry strategy.
 *
 * The public constants in `./constants` keep their earlier values, which the
 * deprecated pre-SRA retry strategy still uses.
 *
 * @internal
 */
export abstract class Retry {
  /**
   * Always true. Kept because previously published packages read this flag.
   *
   * @deprecated the 2026 retry behavior is always enabled. May be removed in a future major version.
   */
  public static readonly v2026 = true;

  public static delay() {
    return 50;
  }

  public static throttlingDelay() {
    return 1_000;
  }

  public static cost() {
    return 14;
  }

  public static throttlingCost() {
    return 5;
  }

  public static modifiedCostType() {
    return "THROTTLING" as const;
  }
}
