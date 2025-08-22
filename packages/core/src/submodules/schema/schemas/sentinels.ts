import type {
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  BooleanSchema,
  DocumentSchema,
  ListSchemaModifier,
  MapSchemaModifier,
  NumericSchema,
  StreamingBlobSchema,
  StringSchema,
  TimestampDateTimeSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";

/**
 * Schema sentinel runtime values.
 * @alpha
 */
export const SCHEMA: {
  BLOB: BlobSchema;
  STREAMING_BLOB: StreamingBlobSchema;
  BOOLEAN: BooleanSchema;
  STRING: StringSchema;
  NUMERIC: NumericSchema;
  BIG_INTEGER: BigIntegerSchema;
  BIG_DECIMAL: BigDecimalSchema;
  DOCUMENT: DocumentSchema;
  TIMESTAMP_DEFAULT: TimestampDefaultSchema;
  TIMESTAMP_DATE_TIME: TimestampDateTimeSchema;
  TIMESTAMP_HTTP_DATE: TimestampHttpDateSchema;
  TIMESTAMP_EPOCH_SECONDS: TimestampEpochSecondsSchema;
  LIST_MODIFIER: ListSchemaModifier;
  MAP_MODIFIER: MapSchemaModifier;
} = {
  BLOB: 0b0001_0101, // 21
  STREAMING_BLOB: 0b0010_1010, // 42
  BOOLEAN: 0b0000_0010, // 2
  STRING: 0b0000_0000, // 0
  NUMERIC: 0b0000_0001, // 1
  BIG_INTEGER: 0b0001_0001, // 17
  BIG_DECIMAL: 0b0001_0011, // 19
  DOCUMENT: 0b0000_1111, // 15
  TIMESTAMP_DEFAULT: 0b0000_0100, // 4
  TIMESTAMP_DATE_TIME: 0b0000_0101, // 5
  TIMESTAMP_HTTP_DATE: 0b0000_0110, // 6
  TIMESTAMP_EPOCH_SECONDS: 0b0000_0111, // 7
  LIST_MODIFIER: 0b0100_0000, // 64
  MAP_MODIFIER: 0b1000_0000, // 128
};
