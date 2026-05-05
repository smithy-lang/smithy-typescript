import { getSmithyContext } from "@smithy/core/client";
import type {
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
  SmithyFeatures,
} from "@smithy/types";

import { getEndpointFromInstructions } from "./adaptors/getEndpointFromInstructions";
import type { EndpointResolvedConfig } from "./resolveEndpointConfig";
import type { EndpointParameterInstructions } from "./types";

function setFeature<F extends keyof SmithyFeatures>(
  context: HandlerExecutionContext,
  feature: F,
  value: SmithyFeatures[F]
) {
  if (!context.__smithy_context) {
    context.__smithy_context = { features: {} };
  } else if (!context.__smithy_context.features) {
    context.__smithy_context.features = {};
  }
  context.__smithy_context.features![feature] = value;
}

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
    ): SerializeHandler<any, Output> =>
    async (args: SerializeHandlerArguments<any>): Promise<SerializeHandlerOutput<Output>> => {
      if (config.isCustomEndpoint) {
        setFeature(context, "ENDPOINT_OVERRIDE", "N");
      }

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
