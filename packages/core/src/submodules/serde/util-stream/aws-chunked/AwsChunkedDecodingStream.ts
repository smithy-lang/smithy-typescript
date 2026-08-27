import { Readable } from "node:stream";

import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";
import { AwsChunkedParser, type AwsChunkedParserOptions } from "./awsChunkedParser";

/**
 * @internal
 */
export interface AwsChunkedDecodingStreamInit extends AwsChunkedParserOptions {
  source: Readable;

  /**
   * Called with the parsed trailers once the terminal trailer section has been
   * consumed.
   */
  onTrailers?: (trailers: Record<string, string>) => void;

  /**
   * Called if the framing could not be decoded, or the source failed.
   */
  onError?: (error: Error) => void;
}

/**
 * Removes `aws-chunked` framing from a Node.js response body.
 *
 * This follows the same shape as ChecksumStream: the source is observed and
 * driven manually with pause/resume rather than using a Transform, so decoded
 * bytes are pulled at the rate they are consumed and encoded data does not
 * accumulate. It should not be rewritten as a Duplex.
 *
 * @internal
 */
export class AwsChunkedDecodingStream extends Readable {
  private source: Readable;
  private readonly parser: AwsChunkedParser;
  private readonly onTrailers?: (trailers: Record<string, string>) => void;
  private readonly onError?: (error: Error) => void;
  private settled = false;

  public constructor({ source, onTrailers, onError, ...parserOptions }: AwsChunkedDecodingStreamInit) {
    super();
    if (typeof source?.pipe !== "function") {
      throw new Error(
        `@smithy/core/serde: unsupported source type ${
          (source as any)?.constructor?.name ?? source
        } in AwsChunkedDecodingStream.`
      );
    }
    this.source = source;
    this.onTrailers = onTrailers;
    this.onError = onError;
    // Constructed before any listener is attached so an invalid declared
    // length is thrown to the caller rather than surfaced on the stream.
    this.parser = new AwsChunkedParser(parserOptions);

    this.source.on("data", this.onSourceData);
    this.source.on("end", this.onSourceEnd);
    this.source.on("error", this.onSourceError);
    this.source.on("close", this.onSourceClose);
    this.source.pause();
  }

  /**
   * Report the trailers or the failure, whichever comes first, at most once.
   */
  private settle(error?: Error): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    if (error) {
      this.onError?.(error);
    } else {
      this.onTrailers?.(this.parser.trailers);
    }
  }

  /**
   * Decode each source chunk and forward the payload bytes it contained,
   * pausing the source when the readable side signals backpressure.
   */
  private onSourceData = (chunk: Buffer): void => {
    if (this.destroyed) {
      return;
    }

    let decoded: Uint8Array[];
    try {
      decoded = this.parser.write(chunk);
    } catch (e: unknown) {
      this.destroy(e as Error);
      return;
    }

    let backpressure = false;
    for (const payload of decoded) {
      // A chunk consisting only of framing yields no payload bytes, in which
      // case the source is left flowing so the next chunk is reached.
      if (!this.push(payload)) {
        backpressure = true;
      }
    }
    if (backpressure) {
      this.source.pause();
    }
  };

  /**
   * When the source finishes, verify the framing is complete and end this stream.
   */
  private onSourceEnd = (): void => {
    if (this.destroyed) {
      return;
    }
    try {
      this.parser.end();
    } catch (e: unknown) {
      this.destroy(e as Error);
      return;
    }
    this.settle();
    this.push(null);
  };

  private onSourceError = (error: Error): void => {
    this.destroy(error);
  };

  /**
   * A source that closes without ending has lost its connection, which leaves
   * the framing truncated.
   */
  private onSourceClose = (): void => {
    if (!this.destroyed && !this.source.readableEnded) {
      this.destroy(new AwsChunkedDecodeError("connection lost or stream closed before the framing was complete."));
    }
  };

  /**
   * Resume the source so it flows at the rate this stream is consumed.
   * Do not call this directly.
   * @internal
   */
  public _read(_size: number): void {
    this.source.resume();
  }

  /**
   * Destroy the upstream source for cleanup so it is not left dangling, then
   * complete this stream's destruction. The error is intentionally not forwarded
   * to the source as the source is typically internal and without an error
   * listener. The error still surfaces on this stream via the callback.
   * Do not call this directly.
   * @internal
   */
  public _destroy(error: Error | null, callback: (error?: Error | null | undefined) => void): void {
    this.settle(
      error ??
        (this.parser.complete
          ? undefined
          : new AwsChunkedDecodeError("the decoded stream was destroyed before the framing was complete."))
    );
    this.source?.removeListener("data", this.onSourceData);
    this.source?.removeListener("end", this.onSourceEnd);
    this.source?.removeListener("error", this.onSourceError);
    this.source?.removeListener("close", this.onSourceClose);
    this.source?.destroy();
    callback(error);
  }
}
