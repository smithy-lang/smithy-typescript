import type { DefaultsMode } from "@smithy/smithy-client";
import type { Provider } from "@smithy/types";

/**
 * @internal
 */
export const DEFAULTS_MODE_OPTIONS = ["in-region", "cross-region", "mobile", "standard", "legacy"];

/**
 * @internal
 */
export interface ResolveDefaultsModeConfigOptions {
  defaultsMode?: DefaultsMode | Provider<DefaultsMode>;
}
