import { toBase64 } from "../../../util-base64/toBase64.browser";
import { isReadableStream } from "../../stream-type-check";
import { AwsChunkedDecoder } from "./AwsChunkedDecoder";
import { WireChecksumStream, type WireChecksumStreamInit } from "./WireChecksumStream.browser";

/**
 * Alias prevents compiler from turning
 * ReadableStream into ReadableStream<any>, which is incompatible
 * with the NodeJS.ReadableStream global type.
 * @internal
 */
export type ReadableStreamType = ReadableStream;

/**
 * This is a local copy of
 * https://developer.mozilla.org/en-US/docs/Web/API/TransformStreamDefaultController
 * in case users do not have this type.
 */
interface TransformStreamDefaultController {
  enqueue(chunk: any): void;
  error(error: unknown): void;
  terminate(): void;
}

/**
 * Creates a stream adapter that validates an S3 wire checksum for streams
 * without buffering the full payload. It decodes the `aws-chunked` framing so
 * the caller only sees decoded object data, and reads the expected checksum
 * from the trailer.
 * @internal
 */
export const createWireChecksumStream = ({
  checksumAlgorithm,
  checksum,
  source,
  decodedContentLength,
  base64Encoder,
}: WireChecksumStreamInit): ReadableStreamType => {
  if (!isReadableStream(source)) {
    throw new Error(
      `@smithy/util-stream: unsupported source type ${
        (source as any)?.constructor?.name ?? source
      } in WireChecksumStream.`
    );
  }

  if (typeof TransformStream !== "function") {
    throw new Error(
      "@smithy/util-stream: unable to instantiate WireChecksumStream because API unavailable: ReadableStream/TransformStream."
    );
  }

  const encoder = base64Encoder ?? toBase64;
  const trailerName = `x-amz-wire-checksum-${checksumAlgorithm.toLowerCase()}`;

  // The expected value is read from the trailer during decoding.
  let expectedChecksumValue: string | undefined;

  // The controller is supplied per transform() call; track the active one so
  // the decoder handlers (created once) can enqueue against it.
  let activeController: TransformStreamDefaultController | undefined;
  const decoder = new AwsChunkedDecoder({
    onData(data: Uint8Array) {
      checksum.update(data);
      activeController!.enqueue(data);
    },
    onTrailer(name: string, value: string) {
      if (name.toLowerCase() === trailerName) {
        expectedChecksumValue = value;
      }
    },
  });

  const transform = new TransformStream({
    start() {},
    async transform(chunk: any, controller: TransformStreamDefaultController) {
      activeController = controller;
      // onData updates the checksum and enqueues the decoded bytes.
      decoder.write(chunk);
    },
    async flush(controller: TransformStreamDefaultController) {
      try {
        decoder.end();
      } catch (e: unknown) {
        controller.error(e);
        return;
      }
      if (decodedContentLength !== undefined && decoder.bytesDecoded !== decodedContentLength) {
        controller.error(
          new Error(
            `@smithy/util-stream: decoded content length mismatch: expected ${decodedContentLength}` +
              ` but decoded ${decoder.bytesDecoded} bytes from the aws-chunked response.`
          )
        );
        return;
      }
      if (expectedChecksumValue === undefined) {
        controller.error(
          new Error(`@smithy/util-stream: wire checksum trailer "${trailerName}" was not present in the response.`)
        );
        return;
      }

      const digest: Uint8Array = await checksum.digest();
      const received = encoder(digest);

      if (expectedChecksumValue !== received) {
        controller.error(
          new Error(
            `Checksum mismatch: expected "${expectedChecksumValue}" but received "${received}"` +
              ` in response trailer "${trailerName}".`
          )
        );
      } else {
        controller.terminate();
      }
    },
  });

  source.pipeThrough(transform);
  const readable = transform.readable;
  Object.setPrototypeOf(readable, WireChecksumStream.prototype);
  return readable;
};
