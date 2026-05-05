/** @deprecated Use @smithy/core/endpoints instead. */
export {
  getEndpointFromInstructions,
  resolveParams,
  toEndpointV1,
  endpointMiddleware,
  endpointMiddlewareOptions,
  getEndpointPlugin,
  resolveEndpointConfig,
  resolveEndpointRequiredConfig,
} from "@smithy/core/endpoints";
export type {
  EndpointInputConfig,
  EndpointResolvedConfig,
  EndpointRequiredInputConfig,
  EndpointRequiredResolvedConfig,
  EndpointParameterInstructions,
  EndpointParameterInstructionsSupplier,
  BuiltInParamInstruction,
  ClientContextParamInstruction,
  ContextParamInstruction,
  OperationContextParamInstruction,
  StaticContextParamInstruction,
} from "@smithy/core/endpoints";
