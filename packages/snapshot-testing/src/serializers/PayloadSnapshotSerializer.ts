import { EventStreamCodec } from "@smithy/eventstream-codec";
import type { Message } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";

import type { PayloadWithHeaders } from "../snapshot-testing-types";
import { serializeBytes } from "./serializeBytes";

export class PayloadSnapshotSerializer {
  public constructor(private r: PayloadWithHeaders) {}

  public isXml(): boolean {
    return this.getContentType() === "application/xml";
  }

  public isQuery(): boolean {
    return this.getContentType() === "application/x-www-form-urlencoded";
  }

  public isJson(): boolean {
    return this.getContentType() === "application/json" || this.getContentType().startsWith("application/x-amz-json-");
  }

  public isCbor(): boolean {
    return this.r.headers?.["smithy-protocol"] === "rpc-v2-cbor" || this.getContentType() === "application/cbor";
  }

  public getContentType(): string {
    return this.r.headers?.["content-type"] ?? "";
  }

  public formatStringBody(s: string): [string, string] {
    try {
      if (this.isJson()) {
        try {
          return ["json", JSON.stringify(JSON.parse(s), null, 2)];
        } catch (e) {}
        return ["json", s];
      } else if (this.isXml()) {
        return ["xml", simpleFormatXml(s)];
      } else if (this.isQuery()) {
        return ["query", formatQuery(s)];
      }
    } catch (e) {}
    return ["??", s];
  }

  public formatBody(bytes: Uint8Array): [string, string] {
    if (this.isCbor()) {
      return ["cbor object view", serializeBytes(bytes)];
    } else {
      return this.formatStringBody(toUtf8(bytes));
    }
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
    const messageDecoder = new EventStreamCodec(toUtf8, fromUtf8);
    const decoded = messageDecoder.decode(chunk as Uint8Array);
    const [payloadAnnotation, payloadSnapshot] = await new PayloadSnapshotSerializer({
      body: decoded.body,
      headers: {
        "content-type": String(decoded.headers[":content-type"]?.value) ?? "",
      },
    }).toStringAsync();

    return `[chunk (event-stream object view)]
${serializeEventHeaders(decoded)}
${payloadAnnotation}
${payloadSnapshot}
${"===".repeat(20)}

`;
  }
  return `[chunk (b64)]
${toBase64(fromUtf8(utf8))}
`;
}

function serializeEventHeaders(message: Message): string {
  const { headers } = message;
  let b = "";
  for (const [k, { type, value }] of Object.entries(headers ?? {})) {
    if (type === "string") {
      b += `${k}: ${value}\n`;
    } else {
      b += `${k}: ${value} (${type})\n`;
    }
  }
  return b;
}

function isEvent(str: string): boolean {
  return str.includes(":message-type") && str.includes(":event-type");
}

/**
 * Inserts line breaks and indentation for XML.
 */
function simpleFormatXml(xml: string): string {
  const indent = 4;
  let b = "";
  let indentation = 0;
  for (let i = 0; i < xml.length; ++i) {
    const c = xml[i];

    if (c === "<") {
      if (xml[i + 1] === "/") {
        b += "\n" + " ".repeat(indentation - indent) + c;
        indentation -= indent * 2;
      } else {
        b += c;
      }
    } else if (c === ">") {
      if (xml[i - 1] === "/" || xml[i - 1] === "?") {
        b += c + "\n";
      } else {
        indentation += indent;
        b += c + "\n" + " ".repeat(indentation);
      }
    } else {
      b += c;
    }
  }
  return b
    .split("\n")
    .filter((s) => !!s.trim())
    .join("\n");
}

/**
 * Inserts line breaks for Query format.
 */
function formatQuery(q: string): string {
  return q.replace(/(&)/g, "&\n");
}
