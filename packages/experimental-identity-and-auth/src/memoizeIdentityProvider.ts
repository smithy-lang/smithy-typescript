import type { Identity, IdentityProvider } from "@smithy/types";

/**
 * @internal
 */
export const createIsIdentityExpiredFunction = (expirationMs: number) => (identity: Identity) =>
  doesIdentityRequireRefresh(identity) && identity.expiration!.getTime() - Date.now() < expirationMs;

/**
 * @internal
 * This may need to be configurable in the future, but for now it is defaulted to 5min.
 */
export const EXPIRATION_MS = 300_000;

/**
 * @internal
 */
export const isIdentityExpired = createIsIdentityExpiredFunction(EXPIRATION_MS);

/**
 * @internal
 */
export const doesIdentityRequireRefresh = (identity: Identity) => identity.expiration !== undefined;

/**
 * @internal
 */
export interface MemoizedIdentityProvider<IdentityT extends Identity> {
  (options?: Record<string, any> & { forceRefresh?: boolean }): Promise<IdentityT>;
}

/**
 * @internal
 */
export const memoizeIdentityProvider = <IdentityT extends Identity>(
  provider: IdentityT | IdentityProvider<IdentityT> | undefined,
  isExpired: (resolved: Identity) => boolean,
  requiresRefresh: (resolved: Identity) => boolean
): MemoizedIdentityProvider<IdentityT> | undefined => {
  if (provider === undefined) {
    return undefined;
  }
  const normalizedProvider: IdentityProvider<IdentityT> =
    typeof provider !== "function" ? async () => Promise.resolve(provider) : provider;
  let resolved: IdentityT;
  let pending: Promise<IdentityT> | undefined;
  let hasResult: boolean;
  let isConstant = false;
  // Wrapper over supplied provider with side effect to handle concurrent invocation.
  const coalesceProvider: MemoizedIdentityProvider<IdentityT> = async (options) => {
    if (!pending) {
      pending = normalizedProvider(options);
    }
    try {
      resolved = await pending;
      hasResult = true;
      isConstant = false;
    } finally {
      pending = undefined;
    }
    return resolved;
  };

  if (isExpired === undefined) {
    // This is a static memoization; no need to incorporate refreshing unless using forceRefresh;
    return async (options) => {
      if (!hasResult || options?.forceRefresh) {
        resolved = await coalesceProvider(options);
      }
      return resolved;
    };
  }

  return async (options) => {
    if (!hasResult || options?.forceRefresh) {
      resolved = await coalesceProvider(options);
    }
    if (isConstant) {
      return resolved;
    }

    if (!requiresRefresh(resolved)) {
      isConstant = true;
      return resolved;
    }
    if (isExpired(resolved)) {
      await coalesceProvider(options);
      return resolved;
    }
    return resolved;
  };
};
