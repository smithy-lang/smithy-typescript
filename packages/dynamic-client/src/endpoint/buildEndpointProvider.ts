import { BinaryDecisionDiagram, decideEndpoint, EndpointCache, resolveEndpoint } from "@smithy/core/endpoints";
import type { EndpointParams, EndpointV2, Logger, RuleSetObject } from "@smithy/types";

import type { AstShape } from "../ast/types";

/**
 * An endpoint provider compatible with `resolveEndpointConfig`.
 *
 * @internal
 */
export type EndpointProvider = (params: EndpointParams, context?: { logger?: Logger }) => EndpointV2;

/**
 * The `smithy.rules#endpointBdd` trait payload, mirroring the arguments of
 * {@link BinaryDecisionDiagram.from}.
 *
 * @internal
 */
interface EndpointBddTrait {
  nodes: number[];
  root: number;
  conditions: unknown[];
  results: unknown[];
}

/**
 * Builds an endpoint provider for a service from its endpoint traits:
 *
 * - `smithy.rules#endpointBdd` → a binary-decision-diagram resolver.
 * - `smithy.rules#endpointRuleSet` → the rules-engine resolver.
 * - otherwise → a passthrough provider that requires a caller-supplied
 *   `endpoint` (the endpoint middleware uses that value directly, so the
 *   provider only runs, and throws, when no endpoint was configured).
 *
 * @param service - the service shape.
 *
 * @returns an endpoint provider.
 *
 * @internal
 */
export function buildEndpointProvider(service: AstShape): EndpointProvider {
  const traits = service.traits ?? {};

  const bddTrait = traits["smithy.rules#endpointBdd"] as EndpointBddTrait | undefined;
  if (bddTrait) {
    const bdd = BinaryDecisionDiagram.from(
      Int32Array.from(bddTrait.nodes),
      bddTrait.root,
      bddTrait.conditions,
      bddTrait.results
    );
    const cache = new EndpointCache({ size: 50, params: ["endpoint"] });
    return (params, context = {}) =>
      cache.get(params, () => decideEndpoint(bdd, { endpointParams: params, logger: context.logger }));
  }

  const ruleSet = traits["smithy.rules#endpointRuleSet"] as RuleSetObject | undefined;
  if (ruleSet) {
    const cache = new EndpointCache({ size: 50, params: ["endpoint"] });
    return (params, context = {}) =>
      cache.get(params, () => resolveEndpoint(ruleSet, { endpointParams: params, logger: context.logger }));
  }

  return (params) => {
    const endpoint = params?.endpoint;
    if (typeof endpoint === "string" && endpoint.length > 0) {
      return { url: new URL(endpoint), properties: {}, headers: {} };
    }
    if (endpoint && typeof endpoint === "object" && "url" in endpoint) {
      return endpoint as unknown as EndpointV2;
    }
    throw new Error(
      "@smithy/dynamic-client - no endpoint could be resolved. The model has no endpoint rules; configure `endpoint` on the client."
    );
  };
}
