import type { Message } from "@smithy/types";
import { toHex } from "@smithy/util-hex-encoding";
import { toUtf8 } from "@smithy/util-utf8";

import { ContentTypeDetection } from "./ContentTypeDetection";

export class SnapshotEventStreamSerializer extends ContentTypeDetection {
  private headers: Message["headers"] = {};

  private totalLength = "";
  private headerLength = "";
  private preludeCrc = "";
  private payloadAnnotation = "";
  private payloadSnapshot = "";
  private messageCrc = "";

  private inner?: SnapshotEventStreamSerializer;

  public constructor(private message: Uint8Array) {
    super();
  }

  public decode() {
    const message = this.message;
    const dv = new DataView(message.buffer, message.byteOffset, message.byteLength);

    const [totalByteLength, headersByteLength, preludeCrc] = [dv.getUint32(0), dv.getUint32(4), dv.getUint32(8)];
    this.totalLength = String(totalByteLength);
    this.headerLength = String(headersByteLength);
    this.preludeCrc = String(preludeCrc);

    const [headers, payload, messageCrc] = [
      message.subarray(12, 12 + headersByteLength),
      message.subarray(12 + headersByteLength, totalByteLength - 4),
      dv.getUint32(totalByteLength - 4),
    ];

    this.messageCrc = String(messageCrc);

    let i = 12;
    while (i < 12 + headersByteLength) {
      const headerNameByteLength = dv.getUint8(i);
      i += 1;
      const headerName = toUtf8(message.subarray(i, i + headerNameByteLength));
      i += headerNameByteLength;
      const headerValueType = dv.getUint8(i);
      i += 1;
      switch (headerValueType) {
        case 0:
        case 1:
          this.headers[headerName] = {
            type: "boolean",
            value: headerValueType === 0,
          };
          break;
        case 2:
          this.headers[headerName] = {
            type: "byte",
            value: dv.getInt8(i),
          };
          i += 1;
          break;
        case 3:
          this.headers[headerName] = {
            type: "short",
            value: dv.getInt16(i),
          };
          i += 2;
          break;
        case 4:
          this.headers[headerName] = {
            type: "integer",
            value: dv.getInt32(i),
          };
          i += 4;
          break;
        case 5:
          this.headers[headerName] = {
            type: "long",
            value: String(dv.getBigInt64(i)) as any,
          };
          i += 8;
          break;
        case 6:
          const blobLength = dv.getUint16(i);
          i += 2;
          this.headers[headerName] = {
            type: "binary",
            value: message.subarray(i, i + blobLength),
          };
          i += blobLength;
          break;
        case 7:
          const stringByteLength = dv.getUint16(i);
          i += 2;
          const value = toUtf8(message.subarray(i, i + stringByteLength));
          this.headers[headerName] = {
            type: "string",
            value,
          };
          i += stringByteLength;
          if (headerName === ":content-type") {
            this.r = {
              headers: {
                "content-type": value,
              },
            };
          }
          break;
        case 8:
          this.headers[headerName] = {
            type: "timestamp",
            value: new Date(Number(dv.getBigUint64(i))),
          };
          i += 8;
          break;
        case 9:
          const uuidBytes = message.subarray(i, i + 16);
          i += 16;
          this.headers[headerName] = {
            type: "uuid",
            value: `${toHex(uuidBytes.subarray(0, 4))}-${toHex(uuidBytes.subarray(4, 6))}-${toHex(
              uuidBytes.subarray(6, 8)
            )}-${toHex(uuidBytes.subarray(8, 10))}-${toHex(uuidBytes.subarray(10))}`,
          };
          break;
        default:
          throw new Error(`Unrecognized header type tag=${headerValueType}`);
      }
    }

    [this.payloadAnnotation, this.payloadSnapshot] = this.formatBody(payload);
    if (this.headers[":chunk-signature"] && payload.byteLength > 0) {
      // is signing transform stream chunk, need to decode another level.
      const inner = new SnapshotEventStreamSerializer(payload);
      inner.decode();
      this.inner = inner;
    }
  }

  public toString() {
    this.decode();
    if (this.inner) {
      const { inner } = this;
      return `[chunk (event-stream object view)]
  [total-size] ${this.totalLength} [header-size] ${this.headerLength} [prelude-crc] ${this.preludeCrc}
    [total-size] ${inner.totalLength} [header-size] ${inner.headerLength} [prelude-crc] ${inner.preludeCrc}
${serializeEventHeaders(this.headers)}
${serializeEventHeaders(inner.headers)}
[${inner.payloadAnnotation}]
${inner.payloadSnapshot}

  [message-crc] ${inner.messageCrc}
[message-crc] ${this.messageCrc}
${"===".repeat(20)}

`;
    }
    return `[chunk (event-stream object view)]
  [total-size] ${this.totalLength} [header-size] ${this.headerLength} [prelude-crc] ${this.preludeCrc}
${serializeEventHeaders(this.headers)}
[${this.payloadAnnotation}]
${this.payloadSnapshot}

[message-crc] ${this.messageCrc}
${"===".repeat(20)}

`;
  }
}

function serializeEventHeaders(headers: Message["headers"]): string {
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
