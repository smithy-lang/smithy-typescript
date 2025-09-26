import type { Checksum } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";
import { toUtf8 } from "@smithy/util-utf8";
import { describe, expect, test as it } from "vitest";

import { headStream } from "../headStream.browser";
import { ChecksumStream as ChecksumStreamWeb } from "./ChecksumStream.browser";
import { createChecksumStream } from "./createChecksumStream.browser";

(typeof ReadableStream === "function" && process.version >= "v18" ? describe : describe.skip)(
  "Checksum streams",
  () => {
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

    describe(createChecksumStream.name + " webstreams API", () => {
      if (typeof ReadableStream !== "function") {
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

      it("should extend a ReadableStream", async () => {
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
  }
);
