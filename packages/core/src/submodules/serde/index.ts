import { getRandomValues } from "node:crypto";

import { fromBase64 } from "./util-base64/fromBase64";
import { toBase64 } from "./util-base64/toBase64";
import { bindUint8ArrayBlobAdapter } from "./util-stream/blob/Uint8ArrayBlobAdapter";
import { fromUtf8 } from "./util-utf8/fromUtf8";
import { toUtf8 } from "./util-utf8/toUtf8";
import { bindV4 } from "./uuid/v4";

export { copyDocumentWithTransform } from "./copyDocumentWithTransform";
export {
  dateToUtcString,
  parseRfc3339DateTime,
  parseRfc3339DateTimeWithOffset,
  parseRfc7231DateTime,
  parseEpochTimestamp,
} from "./date-utils";
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
export { toBase64, fromBase64 };

// @smithy/util-body-length-browser and @smithy/util-body-length-node
export { calculateBodyLength } from "./util-body-length/calculateBodyLength";

// @smithy/util-utf8
export { toUint8Array } from "./util-utf8/toUint8Array";
export { toUtf8, fromUtf8 };

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

// @smithy/hash-node
export { Hash } from "./hash-node/hash-node";

// @smithy/util-stream
export class Uint8ArrayBlobAdapter extends bindUint8ArrayBlobAdapter(toUtf8, fromUtf8, toBase64, fromBase64) {}
export { ChecksumStream, type ChecksumStreamInit } from "./util-stream/checksum/ChecksumStream";
export { createChecksumStream } from "./util-stream/checksum/createChecksumStream";
export { createBufferedReadable } from "./util-stream/createBufferedReadable";
export { getAwsChunkedEncodingStream } from "./util-stream/getAwsChunkedEncodingStream";
export { headStream } from "./util-stream/headStream";
export { sdkStreamMixin } from "./util-stream/sdk-stream-mixin";
export { splitStream } from "./util-stream/splitStream";
export { isReadableStream, isBlob } from "./util-stream/stream-type-check";

// @smithy/uuid
const _getRandomValues = getRandomValues as (array: Uint8Array) => Uint8Array;
export const v4 = bindV4(_getRandomValues);
export const generateIdempotencyToken = v4;
