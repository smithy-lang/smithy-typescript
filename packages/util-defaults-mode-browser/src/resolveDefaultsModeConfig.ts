import { memoize } from "@smithy/property-provider";
import type { DefaultsMode, ResolvedDefaultsMode } from "@smithy/smithy-client";
import type { Provider } from "@smithy/types";

import { DEFAULTS_MODE_OPTIONS } from "./constants";

/**
 * @internal
 */
export interface ResolveDefaultsModeConfigOptions {
  defaultsMode?: DefaultsMode | Provider<DefaultsMode>;
}

/**
 * Validate the defaultsMode configuration. If the value is set to "auto", it
 * resolves the value to "mobile" if the app is running in a mobile browser,
 * otherwise it resolves to "standard".
 *
 * @default "legacy"
 * @internal
 */
export const resolveDefaultsModeConfig = ({
  defaultsMode,
}: ResolveDefaultsModeConfigOptions = {}): Provider<ResolvedDefaultsMode> =>
  memoize(async () => {
    const mode = typeof defaultsMode === "function" ? await defaultsMode() : defaultsMode;
    switch (mode?.toLowerCase()) {
      case "auto":
        return Promise.resolve(useMobileConfiguration() ? "mobile" : "standard");
      case "mobile":
      case "in-region":
      case "cross-region":
      case "standard":
      case "legacy":
        return Promise.resolve(mode?.toLocaleLowerCase() as ResolvedDefaultsMode);
      case undefined:
        return Promise.resolve("legacy");
      default:
        throw new Error(
          `Invalid parameter for "defaultsMode", expect ${DEFAULTS_MODE_OPTIONS.join(", ")}, got ${mode}`
        );
    }
  });

/**
 * The aim of the mobile detection function is not really to know whether the device is a mobile device.
 * This is emphasized in the modern guidance on browser detection that feature detection is correct
 * whereas UA "sniffing" is usually a mistake.
 *
 * So then, the underlying reason we are trying to detect a mobile device is not for any particular device feature,
 * but rather the implied network speed available to the program (we use it to set a default request timeout value).
 *
 * Therefore, it is better to use network speed related feature detection when available. This also saves
 * 20kb (minified) from the bowser dependency we were using.
 *
 * @internal
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent
 */
const useMobileConfiguration = (): boolean => {
  const networkInformation = (window?.navigator as any)?.connection;
  if (networkInformation?.effectiveType) {
    // https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/effectiveType
    // The maximum will report as 4g, regardless of 5g or further developments.
    return networkInformation?.effectiveType !== "4g";
  }

  // without the networkInformation object, we use the touch feature detection as a proxy.
  return typeof window?.navigator?.maxTouchPoints === "number" && window.navigator.maxTouchPoints > 1;
};
