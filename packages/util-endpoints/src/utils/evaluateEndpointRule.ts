import type { EndpointV2 } from "@smithy/types";

import { debugId, toDebugString } from "../debug";
import type { EndpointRuleObject, EvaluateOptions } from "../types";
import { evaluateConditions } from "./evaluateConditions";
import { getEndpointHeaders } from "./getEndpointHeaders";
import { getEndpointProperties } from "./getEndpointProperties";
import { getEndpointUrl } from "./getEndpointUrl";

export const evaluateEndpointRule = (
  endpointRule: EndpointRuleObject,
  options: EvaluateOptions
): EndpointV2 | undefined => {
  const { conditions, endpoint } = endpointRule;

  const { result, referenceRecord } = evaluateConditions(conditions, options);
  if (!result) {
    return;
  }

  const endpointRuleOptions = referenceRecord
    ? {
        ...options,
        referenceRecord: { ...options.referenceRecord, ...referenceRecord },
      }
    : options;

  const { url, properties, headers } = endpoint;

  options.logger?.debug?.(`${debugId} Resolving endpoint from template: ${toDebugString(endpoint)}`);

  const endpointToReturn: EndpointV2 = { url: getEndpointUrl(url, endpointRuleOptions) };
  if (headers != null) {
    endpointToReturn.headers = getEndpointHeaders(headers, endpointRuleOptions);
  }
  if (properties != null) {
    endpointToReturn.properties = getEndpointProperties(properties, endpointRuleOptions);
  }

  return endpointToReturn;
};
