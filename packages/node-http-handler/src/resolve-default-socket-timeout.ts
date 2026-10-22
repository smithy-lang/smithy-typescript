/**
 * @internal
 */
export const resolveDefaultSocketTimeout = (config: unknown): number | undefined => {
  const value = (config as { defaultSocketTimeout?: unknown } | null | undefined)?.defaultSocketTimeout;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
};
