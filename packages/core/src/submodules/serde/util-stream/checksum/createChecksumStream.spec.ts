import { Readable } from "node:stream";
import type { Checksum } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { toBase64 } from "../../util-base64/toBase64";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { headStream } from "../headStream";
import { ChecksumStream } from "./ChecksumStream";
import { ChecksumStream as ChecksumStreamWeb } from "./ChecksumStream.browser";
import { createChecksumStream } from "./createChecksumStream";

/**
 * createChecksumStream is a thin factory whose own responsibility is selecting
 * the correct implementation based on the source type and forwarding the init.
 *
 * - For a Node.js Readable source it constructs the {@link ChecksumStream} class,
 *   whose behavior is tested in ChecksumStream.spec.ts.
 * - For a web ReadableStream source the behavior is implemented in
 *   createChecksumStream.browser.ts, so those behavioral cases live here (and in
 *   createChecksumStream.browser.spec.ts) because there is no separate class.
 */
describe(createChecksumStream.name, () => {
  /**
   * Hash "algorithm" that appends all data together.
   */
  class Appender implements Checksum {
    public hash = "";
    async digest(): Promise<Uint8Array> {
      return Buffer.from(this.hash);
    }
    reset(): void {
      throw new Error("Function not implemented.");
    }
    update(chunk: Uint8Array): void {
      this.hash += toUtf8(chunk);
    }
  }

  const canonicalData = new Uint8Array("abcdefghijklmnopqrstuvwxyz".split("").map((_) => _.charCodeAt(0)));

  const canonicalUtf8 = toUtf8(canonicalData);
  const canonicalBase64 = toBase64(canonicalUtf8);

  describe("source type selection", () => {
    it("should select the Node.js ChecksumStream for a Readable source and forward the init", async () => {
      const stream = Readable.from(Buffer.from(canonicalData.buffer, 0, 26));
      const checksumStream = createChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: stream,
      });

      expect(checksumStream).toBeInstanceOf(Readable);
      expect(checksumStream).toBeInstanceOf(ChecksumStream);

      // Smoke test: the wired-up stream reads through to completion, which only
      // succeeds if the init values were forwarded to the implementation.
      const collected = toUtf8(await headStream(checksumStream, Infinity));
      expect(collected).toEqual(canonicalUtf8);
      expect(stream.readableEnded).toEqual(true);
      expect(checksumStream.readableEnded).toEqual(true);
    });
  });

  describe("webstreams API", () => {
    if (typeof ReadableStream !== "function") {
      it.skip("Skipped when ReadableStream is not globally available.", () => {});
      // test not applicable to Node.js 16.
      return;
    }

    const makeStream = () => {
      return new ReadableStream({
        start(controller) {
          canonicalData.forEach((byte) => {
            controller.enqueue(new Uint8Array([byte]));
          });
          controller.close();
        },
      });
    };

    it("should select the web ChecksumStream for a ReadableStream source", async () => {
      const stream = makeStream();
      const checksumStream = createChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: stream,
      });

      expect(checksumStream).toBeInstanceOf(ReadableStream);
      expect(checksumStream).toBeInstanceOf(ChecksumStreamWeb);

      const collected = toUtf8(await headStream(checksumStream, Infinity));
      expect(collected).toEqual(canonicalUtf8);
      expect(stream.locked).toEqual(true);

      // expectation is that it is resolved.
      expect(await checksumStream.getReader().closed);
    });

    it("should throw during stream read if the checksum does not match", async () => {
      const stream = makeStream();
      const checksumStream = createChecksumStream({
        expectedChecksum: "different-expected-checksum",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: stream,
      });

      try {
        toUtf8(await headStream(checksumStream, Infinity));
        throw new Error("stream was read successfully");
      } catch (e: unknown) {
        expect(String(e)).toEqual(
          `Error: Checksum mismatch: expected "different-expected-checksum" but` +
            ` received "${canonicalBase64}"` +
            ` in response header "my-header".`
        );
      }
    });
  });
});
