import {
  AuthScheme,
  EndpointParameters,
  EndpointV2,
  HandlerExecutionContext,
  MetadataBearer,
  SelectedHttpAuthScheme,
  SerializeHandler,
  SerializeHandlerArguments,
  SerializeHandlerOutput,
  SerializeMiddleware,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { getEndpointFromInstructions } from "./adaptors/getEndpointFromInstructions";
import { EndpointResolvedConfig } from "./resolveEndpointConfig";
import { EndpointParameterInstructions } from "./types";

/**
 * @internal
 */
interface EndpointMiddlewareSmithyContext extends Record<string, unknown> {
  selectedHttpAuthScheme?: SelectedHttpAuthScheme;
}

/**
 * @internal
 */
export const endpointMiddleware = <T extends EndpointParameters>({
  config,
  instructions,
}: {
  config: EndpointResolvedConfig<T>;
  instructions: EndpointParameterInstructions;
}): SerializeMiddleware<any, any> => {
  return <Output extends MetadataBearer>(
    next: SerializeHandler<any, Output>,
    context: HandlerExecutionContext
  ): SerializeHandler<any, Output> => async (
    args: SerializeHandlerArguments<any>
  ): Promise<SerializeHandlerOutput<Output>> => {
    const endpoint: EndpointV2 = await getEndpointFromInstructions(
      args.input,
      {
        getEndpointParameterInstructions() {
          return instructions;
        },
      },
      { ...config },
      context
    );

    context.endpointV2 = endpoint;
    context.authSchemes = endpoint.properties?.authSchemes;

    const authScheme: AuthScheme | undefined = context.authSchemes?.[0];
    if (authScheme) {
      context["signing_region"] = authScheme.signingRegion;
      context["signing_service"] = authScheme.signingName;
      const smithyContext: EndpointMiddlewareSmithyContext = getSmithyContext(context);
      const httpAuthOption = smithyContext?.selectedHttpAuthScheme?.httpAuthOption;
      if (httpAuthOption) {
        // TODO(experimentalIdentityAndAuth): Should be constrained somehow, but currently the only properties
        //                                    found were `signing_region` and `signing_service`.
        httpAuthOption.signingProperties = Object.assign(
          httpAuthOption.signingProperties || {},
          {
            signing_region: authScheme.signingRegion,
            signingRegion: authScheme.signingRegion,
            signing_service: authScheme.signingName,
            signingName: authScheme.signingName,
            signingRegionSet: authScheme.signingRegionSet,
          },
          authScheme.properties
        );
      }
    }

    return next({
      ...args,
    });
  };
};
