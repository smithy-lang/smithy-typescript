export { copyDocumentWithTransform } from "./copyDocumentWithTransform";
export {
  dateToUtcString,
  parseRfc3339DateTime,
  parseRfc3339DateTimeWithOffset,
  parseRfc7231DateTime,
  parseEpochTimestamp,
} from "./date-utils";
export { generateIdempotencyToken } from "./generateIdempotencyToken";
export { LazyJsonString, type AutomaticJsonStringConversion } from "./lazy-json";
export {
  logger,
  parseBoolean,
  expectBoolean,
  expectNumber,
  expectFloat32,
  expectInt,
  expectInt32,
  expectShort,
  expectByte,
  expectNonNull,
  expectObject,
  expectString,
  expectUnion,
  expectLong,
  strictParseDouble,
  strictParseFloat,
  strictParseFloat32,
  strictParseLong,
  strictParseInt,
  strictParseInt32,
  strictParseShort,
  strictParseByte,
  limitedParseDouble,
  handleFloat,
  limitedParseFloat,
  limitedParseFloat32,
} from "./parse-utils";
export { quoteHeader } from "./quote-header";
export {
  _parseEpochTimestamp,
  _parseRfc3339DateTimeWithOffset,
  _parseRfc7231DateTime,
} from "./schema-serde-lib/schema-date-utils";
export { splitEvery } from "./split-every";
export { splitHeader } from "./split-header";
export { NumericValue, nv, type NumericType } from "./value/NumericValue";

// @smithy/util-hex-encoding
export { fromHex, toHex } from "./util-hex-encoding/hex-encoding";

// @smithy/util-base64
export { fromBase64 } from "./util-base64/fromBase64.browser";
export { toBase64 } from "./util-base64/toBase64.browser";

// @smithy/util-body-length-browser
export { calculateBodyLength } from "./util-body-length/calculateBodyLength.browser";

// @smithy/util-utf8
export { fromUtf8 } from "./util-utf8/fromUtf8.browser";
export { toUint8Array } from "./util-utf8/toUint8Array";
export { toUtf8 } from "./util-utf8/toUtf8.browser";

// @smithy/util-buffer-from
export { fromArrayBuffer, fromString, type StringEncoding } from "./util-buffer-from/buffer-from";

// @smithy/is-array-buffer
export { isArrayBuffer } from "./is-array-buffer/is-array-buffer";

// @smithy/middleware-serde
export { deserializerMiddleware } from "./middleware-serde/deserializerMiddleware";
export {
  deserializerMiddlewareOption,
  serializerMiddlewareOption,
  getSerdePlugin,
  type V1OrV2Endpoint,
} from "./middleware-serde/serdePlugin";
export { serializerMiddleware } from "./middleware-serde/serializerMiddleware";

// @smithy/util-stream
export { Uint8ArrayBlobAdapter } from "./util-stream/blob/Uint8ArrayBlobAdapter";
export { ChecksumStream, type ChecksumStreamInit } from "./util-stream/checksum/ChecksumStream.browser";
export { createChecksumStream } from "./util-stream/checksum/createChecksumStream.browser";
export { createBufferedReadable } from "./util-stream/createBufferedReadable.browser";
export { getAwsChunkedEncodingStream } from "./util-stream/getAwsChunkedEncodingStream.browser";
export { headStream } from "./util-stream/headStream.browser";
export { sdkStreamMixin } from "./util-stream/sdk-stream-mixin.browser";
export { splitStream } from "./util-stream/splitStream.browser";
export { isReadableStream, isBlob } from "./util-stream/stream-type-check";

// @smithy/uuid
export { v4 } from "./uuid/v4";
