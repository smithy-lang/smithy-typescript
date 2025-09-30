import type { NormalizedSchema } from "@smithy/core/schema";
import type {
  CodecSettings,
  TimestampDateTimeSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";

/**
 * Assuming the schema is a timestamp type, the function resolves the format using
 * either the timestamp's own traits, or the default timestamp format from the CodecSettings.
 *
 * @internal
 */
export function determineTimestampFormat(
  ns: NormalizedSchema,
  settings: CodecSettings
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

  const { httpLabel, httpPrefixHeaders, httpHeader, httpQuery } = ns.getMergedTraits();

  const bindingFormat = settings.httpBindings
    ? typeof httpPrefixHeaders === "string" || Boolean(httpHeader)
      ? (6 satisfies TimestampHttpDateSchema)
      : Boolean(httpQuery) || Boolean(httpLabel)
        ? (5 satisfies TimestampDateTimeSchema)
        : undefined
    : undefined;

  return bindingFormat ?? settings.timestampFormat.default;
}
