import { AwsChunkedParser } from "./awsChunkedParser";
import {
  createAwsChunkedResponseDecoder as createAwsChunkedResponseDecoderWeb,
  type ReadableStreamType,
} from "./createAwsChunkedResponseDecoder.browser";
import type { AwsChunkedResponseDecoderOptions, AwsChunkedResponseDecoderResult } from "./types";
import { isBlob } from "../stream-type-check";

/**
 * Read a Blob into a single byte array.
 *
 * `Blob.arrayBuffer` is preferred. FileReader is the fallback for react-native
 * and older environments where it is unavailable.
 */
const collectBlob = async (blob: Blob): Promise<Uint8Array> => {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (typeof FileReader !== "function") {
    throw new Error(
      "@smithy/core/serde: unable to decode an aws-chunked Blob because API unavailable: Blob.arrayBuffer/FileReader."
    );
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.readyState !== 2) {
        reject(new Error("@smithy/core/serde: reader aborted while collecting an aws-chunked Blob."));
        return;
      }
      resolve(new Uint8Array((reader.result as ArrayBuffer) ?? new ArrayBuffer(0)));
    };
    reader.onabort = () =>
      reject(new Error("@smithy/core/serde: reader aborted while collecting an aws-chunked Blob."));
    reader.onerror = () => reject(reader.error ?? new Error("@smithy/core/serde: failed to read an aws-chunked Blob."));
    reader.readAsArrayBuffer(blob);
  });
};

/**
 * Removes `aws-chunked` framing from a response body on react-native.
 *
 * A web stream, or a Blob that can produce one, is decoded incrementally
 * through the shared web adapter. A Blob without `stream()` is collected in full
 * and decoded through the same parser core, which uses memory proportional to
 * the response because no streaming Blob API is available.
 *
 * @internal
 */
export function createAwsChunkedResponseDecoder(
  options: AwsChunkedResponseDecoderOptions<ReadableStreamType | Blob>
): AwsChunkedResponseDecoderResult<ReadableStreamType> {
  const { source, declaredTrailers, decodedContentLength } = options;

  if (isBlob(source)) {
    if (typeof source.stream === "function") {
      return createAwsChunkedResponseDecoderWeb({
        ...options,
        source: source.stream() as ReadableStreamType,
      });
    }

    // Constructed eagerly so an invalid declared length throws to the caller.
    const parser = new AwsChunkedParser({ declaredTrailers, decodedContentLength });

    const decoded = (async (): Promise<Uint8Array[]> => {
      const payloads = parser.write(await collectBlob(source));
      parser.end();
      return payloads;
    })();

    const trailers = decoded.then(() => parser.trailers);
    // Mark as handled so a caller that never reads the trailers does not raise
    // an unhandled rejection. Real awaiters still observe the rejection.
    trailers.catch(() => {});

    const body = new ReadableStream({
      async start(controller) {
        try {
          for (const payload of await decoded) {
            controller.enqueue(payload);
          }
        } catch (e: unknown) {
          controller.error(e);
          return;
        }
        controller.close();
      },
    });

    return { body, trailers };
  }

  return createAwsChunkedResponseDecoderWeb(options as AwsChunkedResponseDecoderOptions<ReadableStreamType>);
}
