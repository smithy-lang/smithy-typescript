import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";
import { AwsChunkedParser } from "./awsChunkedParser";
import type { AwsChunkedResponseDecoderOptions, AwsChunkedResponseDecoderResult } from "./types";

/**
 * Alias prevents compiler from turning
 * ReadableStream into ReadableStream<any>, which is incompatible
 * with the NodeJS.ReadableStream global type.
 * @internal
 */
export type ReadableStreamType = ReadableStream;

/**
 * Removes `aws-chunked` framing from a web response body.
 *
 * The parser core is shared with the Node.js adapter, so framing and
 * malformed-response behaviour are identical across runtimes. Backpressure is
 * preserved by reading from the source only when the decoded stream is pulled,
 * and cancelling the decoded stream cancels the source.
 *
 * @internal
 */
export const createAwsChunkedResponseDecoder = ({
  source,
  declaredTrailers,
  decodedContentLength,
}: AwsChunkedResponseDecoderOptions<ReadableStreamType>): AwsChunkedResponseDecoderResult<ReadableStreamType> => {
  if (typeof ReadableStream !== "function") {
    throw new Error("@smithy/core/serde: unable to decode aws-chunked because API unavailable: ReadableStream.");
  }

  // Constructed eagerly so an invalid declared length throws to the caller
  // rather than surfacing on the stream.
  const parser = new AwsChunkedParser({ declaredTrailers, decodedContentLength });

  let resolveTrailers!: (trailers: Record<string, string>) => void;
  let rejectTrailers!: (error: Error) => void;
  const trailers = new Promise<Record<string, string>>((resolve, reject) => {
    resolveTrailers = resolve;
    rejectTrailers = reject;
  });
  // Mark the promise as handled so a caller that never reads it, such as one
  // that selected a stored checksum instead, does not raise an unhandled
  // rejection. Real awaiters still observe the rejection.
  trailers.catch(() => {});

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

  const reader = source.getReader();

  const body = new ReadableStream({
    async pull(controller) {
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await reader.read();
        } catch (e: unknown) {
          settle(e as Error);
          throw e;
        }

        if (result.done) {
          try {
            parser.end();
          } catch (e: unknown) {
            settle(e as Error);
            throw e;
          }
          settle();
          controller.close();
          return;
        }

        let decoded: Uint8Array[];
        try {
          decoded = parser.write(result.value);
        } catch (e: unknown) {
          settle(e as Error);
          const cancellation = reader.cancel(e);
          reader.releaseLock();
          // Cancellation failure must not replace the more useful decoding error.
          cancellation.catch(() => {});
          throw e;
        }

        if (decoded.length > 0) {
          for (const payload of decoded) {
            controller.enqueue(payload);
          }
          return;
        }
        // The source chunk held only framing bytes, so read again rather than
        // returning without enqueueing anything.
      }
    },
    cancel(reason) {
      settle(
        parser.complete
          ? undefined
          : new AwsChunkedDecodeError("the decoded stream was cancelled before the framing was complete.")
      );
      return reader.cancel(reason);
    },
  });

  return { body, trailers };
};
