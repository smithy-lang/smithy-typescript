// eslint-disable-next-line no-restricted-imports
export { getSmithyContext } from "@smithy/core/transport";
export * from "./legacy-root-exports/middleware-http-auth-scheme";
export * from "./legacy-root-exports/middleware-http-signing";
export * from "./normalizeProvider";
export { createPaginator } from "./legacy-root-exports/pagination/createPaginator";
/**
 * Backwards compatibility re-export.
 * @internal
 */
export { requestBuilder } from "@smithy/core/protocols";
export * from "./setFeature";
export * from "./legacy-root-exports/util-identity-and-auth";
