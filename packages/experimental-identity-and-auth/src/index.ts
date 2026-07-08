export type { HttpAuthOption, HttpAuthScheme, HttpAuthSchemeId, SelectedHttpAuthScheme } from "./HttpAuthScheme";
export type {
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  HttpAuthSchemeProvider,
} from "./HttpAuthSchemeProvider";
export type { HttpSigner } from "./HttpSigner";
export { DefaultIdentityProviderConfig } from "./IdentityProviderConfig";
export type { IdentityProviderConfig } from "./IdentityProviderConfig";
export { SigV4Signer } from "./SigV4Signer";
export type { ApiKeyIdentity, ApiKeyIdentityProvider } from "./apiKeyIdentity";
export {
  createEndpointRuleSetHttpAuthSchemeParametersProvider,
  createEndpointRuleSetHttpAuthSchemeProvider,
} from "./endpointRuleSet";
export type {
  DefaultEndpointResolver,
  EndpointRuleSetHttpAuthSchemeParametersProvider,
  EndpointRuleSetHttpAuthSchemeProvider,
  EndpointRuleSetSmithyContext,
} from "./endpointRuleSet";
export { HttpApiKeyAuthLocation, HttpApiKeyAuthSigner } from "./httpApiKeyAuth";
export { HttpBearerAuthSigner } from "./httpBearerAuth";
export {
  EXPIRATION_MS,
  createIsIdentityExpiredFunction,
  doesIdentityRequireRefresh,
  isIdentityExpired,
  memoizeIdentityProvider,
} from "./memoizeIdentityProvider";
export type { MemoizedIdentityProvider } from "./memoizeIdentityProvider";
export {
  getHttpAuthSchemeEndpointRuleSetPlugin,
  getHttpAuthSchemePlugin,
  httpAuthSchemeEndpointRuleSetMiddlewareOptions,
  httpAuthSchemeMiddleware,
  httpAuthSchemeMiddlewareOptions,
} from "./middleware-http-auth-scheme";
export type { PreviouslyResolved } from "./middleware-http-auth-scheme";
export { getHttpSigningPlugin, httpSigningMiddleware, httpSigningMiddlewareOptions } from "./middleware-http-signing";
export { NoAuthSigner } from "./noAuth";
export type { TokenIdentity, TokenIdentityProvider } from "./tokenIdentity";
