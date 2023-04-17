import type { DefaultsMode } from "@smithy-io/smithy-client";
import type { Provider } from "@smithy-io/types";

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
