import { toBase64 } from "@smithy/util-base64";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";

import type { PayloadWithHeaders } from "../snapshot-testing-types";
import { ContentTypeDetection } from "./ContentTypeDetection";
import { SnapshotEventStreamSerializer } from "./SnapshotEventStreamSerializer";

export class SnapshotPayloadSerializer extends ContentTypeDetection {
  public constructor(protected r: PayloadWithHeaders) {
    super();
  }

  /**
   * @returns [body type hint, body snapshot serialization]
   */
  public async toStringAsync(): Promise<[string, string]> {
    const { body } = this.r;
    if (typeof body === "undefined") {
      return [`[no body]`, ""];
    }
    if (typeof body === "string") {
      const [annotation, payloadSnapshot] = this.formatStringBody(body);
      return [`[string (${annotation})]`, payloadSnapshot];
    }
    let b = ``;
    let header = ``;

    if (body instanceof Uint8Array) {
      const [annotation, payloadSnapshot] = this.formatBody(body);
      return [`[Uint8Array (${annotation})]`, payloadSnapshot];
    } else if (typeof body[Symbol.iterator] === "function") {
      const iterable = body as {
        [Symbol.iterator](): IterableIterator<unknown>;
      };
      const ctor = body.constructor.name;
      header = `[iterable (${ctor})]\n`;
      for (const chunk of iterable) {
        b += await serializeChunk(chunk);
      }
    } else if (typeof body[Symbol.asyncIterator] === "function") {
      const asyncIterable = body as {
        [Symbol.asyncIterator](): AsyncIterableIterator<unknown>;
      };
      const ctor = body.constructor.name;
      header = `[async_iterable (${ctor})]\n`;
      for await (const chunk of asyncIterable) {
        b += await serializeChunk(chunk);
      }
    } else {
      throw new Error(`cannot serialize [body=${body}] without iterator.`);
    }
    return [header, b];
  }
}

/**
 * Serialize a single chunk of a stream (HTTP payload).
 */
async function serializeChunk(chunk: unknown): Promise<string> {
  if (!(chunk instanceof Uint8Array) && typeof chunk !== "string") {
    chunk = String(chunk);
  }
  const utf8 = toUtf8(chunk as any) + "\n";
  if (isEvent(utf8)) {
    const messageSerializer = new SnapshotEventStreamSerializer(chunk as Uint8Array);
    return messageSerializer.toString();
  }
  return `[chunk (b64)]
${toBase64(fromUtf8(utf8))}
`;
}

function isEvent(str: string): boolean {
  return (
    (str.includes(":message-type") && str.includes(":event-type")) ||
    str.includes(":date") ||
    str.includes(":chunk-signature")
  );
}
