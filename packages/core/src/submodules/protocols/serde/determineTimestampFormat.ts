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
  const schema = ns.getSchema();
  if (settings.timestampFormat.useTrait) {
    if (
      schema === (5 satisfies TimestampDateTimeSchema) ||
      schema === (6 satisfies TimestampHttpDateSchema) ||
      schema === (7 satisfies TimestampEpochSecondsSchema)
    ) {
      return schema;
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
