import type { NormalizedSchema } from "@smithy/core/schema";
import { SCHEMA } from "@smithy/core/schema";
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
      (ns.getSchema() === SCHEMA.TIMESTAMP_DATE_TIME ||
        ns.getSchema() === SCHEMA.TIMESTAMP_HTTP_DATE ||
        ns.getSchema() === SCHEMA.TIMESTAMP_EPOCH_SECONDS)
    ) {
      return ns.getSchema() as TimestampDateTimeSchema | TimestampHttpDateSchema | TimestampEpochSecondsSchema;
    }
  }

  const { httpLabel, httpPrefixHeaders, httpHeader, httpQuery } = ns.getMergedTraits();
  const bindingFormat = settings.httpBindings
    ? typeof httpPrefixHeaders === "string" || Boolean(httpHeader)
      ? SCHEMA.TIMESTAMP_HTTP_DATE
      : Boolean(httpQuery) || Boolean(httpLabel)
        ? SCHEMA.TIMESTAMP_DATE_TIME
        : undefined
    : undefined;

  return bindingFormat ?? settings.timestampFormat.default;
}
