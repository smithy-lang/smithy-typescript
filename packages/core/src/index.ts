/**
 * Submodules annotated with "Legacy" are from prior to the submodule system.
 * They are exported from the package's root index to preserve backwards compatibility.
 *
 * New development should go in a proper submodule and not be exported from the root index.
 */

/**
 * Legacy submodule list.
 */
export * from "./submodules/middleware-http-auth-scheme/index";
export * from "./submodules/middleware-http-signing/index";
export * from "./submodules/util-identity-and-auth/index";
export * from "./submodules/protocols/index";
export { createPaginator } from "./submodules/pagination/index";

export * from "./getSmithyContext";
export * from "./normalizeProvider";

/**
 * Warning: do not export any additional submodules from the root of this package. See readme.md for
 * guide on developing submodules.
 */
