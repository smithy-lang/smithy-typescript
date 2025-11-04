import { isValidHostLabel } from "@smithy/util-endpoints";

/**
 * @internal
 */
const validRegions = new Set<string>();

/**
 * Checks whether region can be a host component.
 *
 * @param region - to check.
 * @param check - checking function.
 *
 * @internal
 */
export const checkRegion = (region: string, check = isValidHostLabel) => {
  if (!validRegions.has(region) && !check(region)) {
    if (region === "*") {
      console.warn(
        `@smithy/config-resolver WARN - Please use the caller region instead of "*". See "sigv4a" in https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/CLIENTS.md.`
      );
    } else {
      throw new Error(`Region not accepted: region="${region}" is not a valid hostname component.`);
    }
  } else {
    validRegions.add(region);
  }
};
