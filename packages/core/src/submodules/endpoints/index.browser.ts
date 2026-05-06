export * from "./toEndpointV1";

// @smithy/util-endpoints
export { BinaryDecisionDiagram } from "./util-endpoints/bdd/BinaryDecisionDiagram";
export { EndpointCache } from "./util-endpoints/cache/EndpointCache";
export { decideEndpoint } from "./util-endpoints/decideEndpoint";
export { isIpAddress } from "./util-endpoints/lib/isIpAddress";
export { isValidHostLabel } from "./util-endpoints/lib/isValidHostLabel";
export { customEndpointFunctions } from "./util-endpoints/utils/customEndpointFunctions";
export { resolveEndpoint } from "./util-endpoints/resolveEndpoint";
export * from "./util-endpoints/types";

// @smithy/middleware-endpoint
export {
  getEndpointFromInstructions,
  resolveParams,
  type EndpointParameterInstructionsSupplier,
} from "./middleware-endpoint/adaptors/getEndpointFromInstructions";
export { toEndpointV1 as middlewareEndpointToEndpointV1 } from "./middleware-endpoint/adaptors/toEndpointV1";
export { endpointMiddleware } from "./middleware-endpoint/endpointMiddleware";
export { endpointMiddlewareOptions, getEndpointPlugin } from "./middleware-endpoint/getEndpointPlugin";
export { resolveEndpointConfig } from "./middleware-endpoint/resolveEndpointConfig";
export type { EndpointInputConfig, EndpointResolvedConfig } from "./middleware-endpoint/resolveEndpointConfig";
export { resolveEndpointRequiredConfig } from "./middleware-endpoint/resolveEndpointRequiredConfig";
export type {
  EndpointRequiredInputConfig,
  EndpointRequiredResolvedConfig,
} from "./middleware-endpoint/resolveEndpointRequiredConfig";
export type { EndpointParameterInstructions } from "./middleware-endpoint/types";
export type {
  BuiltInParamInstruction,
  ClientContextParamInstruction,
  ContextParamInstruction,
  OperationContextParamInstruction,
  StaticContextParamInstruction,
} from "./middleware-endpoint/types";
