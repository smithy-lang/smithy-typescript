// smithy-typescript generated code
import { type EndpointParams, decideEndpoint, EndpointCache } from "@smithy/core/endpoints";
import type { EndpointV2, Logger } from "@smithy/types";

import { bdd } from "./bdd";
import type { EndpointParameters } from "./EndpointParameters";

const cache = new EndpointCache({
  size: 50,
  params: ["ApiKey", "CustomHeaderValue", "endpoint"],
});

/**
 * @internal
 */
export const defaultEndpointResolver = (
  endpointParams: EndpointParameters,
  context: { logger?: Logger } = {}
): EndpointV2 => {
  const params = { ...endpointParams } as EndpointParams;
  params.OverloadedParam ??= "overloaded!";
  return cache.get(params, () =>
    decideEndpoint(bdd, {
      endpointParams: params,
      logger: context.logger,
    })
  );
};
