import { isBlob } from "../stream-type-check";
import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";
import { AwsChunkedParser } from "./awsChunkedParser";
import {
  createAwsChunkedResponseDecoder as createAwsChunkedResponseDecoderWeb,
  type ReadableStreamType,
} from "./createAwsChunkedResponseDecoder.browser";
import type { AwsChunkedResponseDecoderOptions, AwsChunkedResponseDecoderResult, TrailerField } from "./types";

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

    const decoded = collectBlob(source).then((bytes) => parser.write(bytes));
    // Collection and parsing begin eagerly. Mark the intermediate promise as
    // handled until the decoded body is consumed.
    decoded.catch(() => {});

    let resolveTrailers!: (trailers: readonly TrailerField[]) => void;
    let rejectTrailers!: (error: Error) => void;
    const trailers = new Promise<readonly TrailerField[]>((resolve, reject) => {
      resolveTrailers = resolve;
      rejectTrailers = reject;
    });
    trailers.catch(() => {});

    let payloadsEmitted = false;
    let settled = false;
    const settle = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        rejectTrailers(error);
      } else {
        resolveTrailers(parser.trailers);
      }
    };

    const body = new ReadableStream({
      async pull(controller) {
        if (!payloadsEmitted) {
          let payloads: Uint8Array[];
          try {
            payloads = await decoded;
          } catch (e: unknown) {
            settle(e as Error);
            controller.error(e);
            return;
          }
          payloadsEmitted = true;
          for (const payload of payloads) {
            controller.enqueue(payload);
          }
          if (payloads.length > 0) {
            // Match streaming adapters by exposing decoded bytes before the
            // subsequent pull validates normal source EOF.
            return;
          }
        }

        try {
          parser.end();
        } catch (e: unknown) {
          settle(e as Error);
          controller.error(e);
          return;
        }
        settle();
        controller.close();
      },
      cancel() {
        settle(
          parser.complete
            ? undefined
            : new AwsChunkedDecodeError("the decoded stream was cancelled before the framing was complete.")
        );
      },
    });

    return { body, trailers };
  }

  return createAwsChunkedResponseDecoderWeb(options as AwsChunkedResponseDecoderOptions<ReadableStreamType>);
}
