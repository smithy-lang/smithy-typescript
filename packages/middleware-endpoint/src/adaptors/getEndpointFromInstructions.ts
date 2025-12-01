import type { EndpointParameters, EndpointV2, HandlerExecutionContext } from "@smithy/types";

import type { EndpointResolvedConfig } from "../resolveEndpointConfig";
import { resolveParamsForS3 } from "../service-customizations";
import type { EndpointParameterInstructions } from "../types";
import { createConfigValueProvider } from "./createConfigValueProvider";
import { getEndpointFromConfig } from "./getEndpointFromConfig";
import { toEndpointV1 } from "./toEndpointV1";

/**
 * @internal
 */
export type EndpointParameterInstructionsSupplier = Partial<{
  getEndpointParameterInstructions(): EndpointParameterInstructions;
}>;

/**
 * This step in the endpoint resolution process is exposed as a function
 * to allow packages such as signers, lib-upload, etc. to get
 * the V2 Endpoint associated to an instance of some api operation command
 * without needing to send it or resolve its middleware stack.
 *
 * @internal
 * @param commandInput         - the input of the Command in question.
 * @param instructionsSupplier - this is typically a Command constructor. A static function supplying the
 *                               endpoint parameter instructions will exist for commands in services
 *                               having an endpoints ruleset trait.
 * @param clientConfig         - config of the service client.
 * @param context              - optional context.
 */
export const getEndpointFromInstructions = async <
  T extends EndpointParameters,
  CommandInput extends Record<string, unknown>,
  Config extends Record<string, unknown>,
>(
  commandInput: CommandInput,
  instructionsSupplier: EndpointParameterInstructionsSupplier,
  clientConfig: Partial<EndpointResolvedConfig<T>> & Config,
  context?: HandlerExecutionContext
): Promise<EndpointV2> => {
  if (!clientConfig.isCustomEndpoint) {
    let endpointFromConfig: string | undefined;

    // This field is guaranteed by the type indicated by the config resolver, but is new
    // and some existing standalone calls to this function may not provide the function, so
    // this check should remain here.
    if (clientConfig.serviceConfiguredEndpoint) {
      endpointFromConfig = await clientConfig.serviceConfiguredEndpoint();
    } else {
      endpointFromConfig = await getEndpointFromConfig(clientConfig.serviceId);
    }

    if (endpointFromConfig) {
      clientConfig.endpoint = () => Promise.resolve(toEndpointV1(endpointFromConfig!));
      clientConfig.isCustomEndpoint = true;
    }
  }

  const endpointParams = await resolveParams(commandInput, instructionsSupplier, clientConfig);

  if (typeof clientConfig.endpointProvider !== "function") {
    throw new Error("config.endpointProvider is not set.");
  }
  const endpoint: EndpointV2 = clientConfig.endpointProvider!(endpointParams as T, context);

  return endpoint;
};

/**
 * @internal
 */
export const resolveParams = async <
  T extends EndpointParameters,
  CommandInput extends Record<string, unknown>,
  Config extends Record<string, unknown>,
>(
  commandInput: CommandInput,
  instructionsSupplier: EndpointParameterInstructionsSupplier,
  clientConfig: Partial<EndpointResolvedConfig<T>> & Config
) => {
  // Initialize clientContextParams to empty object if undefined 
  // when accessing nested properties during parameter resolution
  const config = clientConfig as typeof clientConfig & { clientContextParams?: Record<string, unknown> };
  if (config.clientContextParams === undefined) {
    config.clientContextParams = {};
  }
  
  const endpointParams: EndpointParameters = {};
  const instructions: EndpointParameterInstructions = instructionsSupplier?.getEndpointParameterInstructions?.() || {};

  for (const [name, instruction] of Object.entries(instructions)) {
    switch (instruction.type) {
      case "staticContextParams":
        endpointParams[name] = instruction.value;
        break;
      case "contextParams":
        endpointParams[name] = commandInput[instruction.name] as string | boolean;
        break;
      case "clientContextParams":
      case "builtInParams":
        endpointParams[name] = await createConfigValueProvider<Config>(instruction.name, name, clientConfig)();
        break;
      case "operationContextParams":
        endpointParams[name] = instruction.get(commandInput);
        break;
      default:
        throw new Error("Unrecognized endpoint parameter instruction: " + JSON.stringify(instruction));
    }
  }

  if (Object.keys(instructions).length === 0) {
    Object.assign(endpointParams, clientConfig);
  }

  if (String(clientConfig.serviceId).toLowerCase() === "s3") {
    await resolveParamsForS3(endpointParams);
  }

  return endpointParams;
};
