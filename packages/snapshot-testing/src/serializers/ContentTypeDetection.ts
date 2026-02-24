import type { HeaderBag } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";

import { serializeBytes } from "./serializeBytes";

export class ContentTypeDetection {
  protected r!: {
    headers: HeaderBag;
  };

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
    return this.r?.headers?.["smithy-protocol"] === "rpc-v2-cbor" || this.getContentType() === "application/cbor";
  }

  public getContentType(): string {
    return this.r?.headers?.["content-type"] ?? "";
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
    if (s.length === 0) {
      return ["empty", s];
    }
    if (isAscii(s)) {
      return ["text", s];
    }
    try {
      return ["unrecognized format as base64", toBase64(fromUtf8(s))];
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

function isAscii(str: string) {
  return /^[\x00-\x7F]*$/.test(str);
}
