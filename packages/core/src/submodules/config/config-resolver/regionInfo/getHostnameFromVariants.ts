import type { EndpointVariant } from "./EndpointVariant";

/**
 * @internal
 * @deprecated unused as of endpointsRuleSets.
 */
export interface GetHostnameFromVariantsOptions {
  useFipsEndpoint: boolean;
  useDualstackEndpoint: boolean;
}

/**
 * @internal
 * @deprecated unused as of endpointsRuleSets.
 */
export const getHostnameFromVariants = (
  variants: EndpointVariant[] = [],
  { useFipsEndpoint, useDualstackEndpoint }: GetHostnameFromVariantsOptions
) =>
  variants.find(
    ({ tags }) => useFipsEndpoint === tags.includes("fips") && useDualstackEndpoint === tags.includes("dualstack")
  )?.hostname;
