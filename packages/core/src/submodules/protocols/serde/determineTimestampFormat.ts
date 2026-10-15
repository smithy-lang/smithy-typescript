import type { NormalizedSchema } from "@smithy/core/schema";
import type {
  CodecSettings,
  TimestampDateTimeSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";

export type HttpBindingValueLocation = "header" | "label" | "query";

/**
 * Assuming the schema is a timestamp type, the function resolves the format using
 * either the timestamp's own traits, or the default timestamp format from the CodecSettings.
 *
 * @internal
 */
export function determineTimestampFormat(
  ns: NormalizedSchema,
  settings: CodecSettings,
  location?: HttpBindingValueLocation
): TimestampDateTimeSchema | TimestampHttpDateSchema | TimestampEpochSecondsSchema {
  if (settings.timestampFormat.useTrait) {
    if (
      ns.isTimestampSchema() &&
      (ns.getSchema() === (5 satisfies TimestampDateTimeSchema) ||
        ns.getSchema() === (6 satisfies TimestampHttpDateSchema) ||
        ns.getSchema() === (7 satisfies TimestampEpochSecondsSchema))
    ) {
      return ns.getSchema() as TimestampDateTimeSchema | TimestampHttpDateSchema | TimestampEpochSecondsSchema;
    }
  }

  let bindingFormat: TimestampDateTimeSchema | TimestampHttpDateSchema | undefined;
  if (settings.httpBindings) {
    if (location === "header") {
      bindingFormat = 6 satisfies TimestampHttpDateSchema;
    } else if (location === "label" || location === "query") {
      bindingFormat = 5 satisfies TimestampDateTimeSchema;
    } else {
      const { httpLabel, httpPrefixHeaders, httpHeader, httpQuery } = ns.getMergedTraits();
      bindingFormat =
        typeof httpPrefixHeaders === "string" || Boolean(httpHeader)
          ? (6 satisfies TimestampHttpDateSchema)
          : Boolean(httpQuery) || Boolean(httpLabel)
            ? (5 satisfies TimestampDateTimeSchema)
            : undefined;
    }
  }

  return bindingFormat ?? settings.timestampFormat.default;
}
