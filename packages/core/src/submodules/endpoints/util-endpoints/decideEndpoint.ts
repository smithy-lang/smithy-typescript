import type { EndpointV2 } from "@smithy/types";

import type { BinaryDecisionDiagram } from "./bdd/BinaryDecisionDiagram";
import type { EndpointResolverOptions } from "./types";
import { EndpointError } from "./types";
import { evaluateCondition } from "./utils/evaluateCondition";
import { evaluateExpression } from "./utils/evaluateExpression";
import { getEndpointHeaders } from "./utils/getEndpointHeaders";
import { getEndpointProperties } from "./utils/getEndpointProperties";
import { getEndpointUrl } from "./utils/getEndpointUrl";

const RESULT = 100_000_000;

/**
 * Resolves an endpoint URL by processing the endpoints bdd and options.
 */
export const decideEndpoint = (bdd: BinaryDecisionDiagram, options: EndpointResolverOptions): EndpointV2 => {
  const { nodes, root, results, conditions } = bdd;

  let ref = root;
  const referenceRecord = {} as Record<string, any>;
  const closure = {
    referenceRecord,
    endpointParams: options.endpointParams,
    logger: options.logger,
  };

  while (ref !== 1 && ref !== -1 && ref < RESULT) {
    const node_i = 3 * (Math.abs(ref) - 1);
    const [condition_i, highRef, lowRef] = [nodes[node_i], nodes[node_i + 1], nodes[node_i + 2]];
    const [fn, argv, assign] = conditions[condition_i];
    const evaluation = evaluateCondition({ fn, assign, argv }, closure);
    if (evaluation.toAssign) {
      const { name, value } = evaluation.toAssign;
      referenceRecord[name] = value;
    }

    ref = ref >= 0 === evaluation.result ? highRef : lowRef;
  }

  if (ref >= RESULT) {
    const result = results[ref - RESULT];
    if (result[0] === -1) {
      const [, errorExpression] = result;
      throw new EndpointError(evaluateExpression(errorExpression!, "Error", closure) as string);
    }
    const [url, properties, headers] = result;

    return {
      url: getEndpointUrl(url, closure),
      properties: getEndpointProperties(properties, closure),
      headers: getEndpointHeaders(headers ?? {}, closure),
    };
  }

  // ref is 1 or -1.
  throw new EndpointError(`No matching endpoint.`);
};
