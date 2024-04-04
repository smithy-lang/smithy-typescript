import type { Int64 as IInt64, MessageHeaders, MessageHeaderValue } from "@smithy/types";
import { fromHex, toHex } from "@smithy/util-hex-encoding";
import { fromUtf8 } from "@smithy/util-utf8";

/**
 * @internal
 * TODO: duplicated from @smithy/eventstream-codec to break large dependency.
 * TODO: This should be moved to its own deduped submodule in @smithy/core when submodules are implemented.
 */
export class HeaderFormatter {
  public format(headers: MessageHeaders): Uint8Array {
    const chunks: Array<Uint8Array> = [];

    for (const headerName of Object.keys(headers)) {
      const bytes = fromUtf8(headerName);
      chunks.push(Uint8Array.from([bytes.byteLength]), bytes, this.formatHeaderValue(headers[headerName]));
    }

    const out = new Uint8Array(chunks.reduce((carry, bytes) => carry + bytes.byteLength, 0));
    let position = 0;
    for (const chunk of chunks) {
      out.set(chunk, position);
      position += chunk.byteLength;
    }

    return out;
  }

  private formatHeaderValue(header: MessageHeaderValue): Uint8Array {
    switch (header.type) {
      case "boolean":
        return Uint8Array.from([header.value ? HEADER_VALUE_TYPE.boolTrue : HEADER_VALUE_TYPE.boolFalse]);
      case "byte":
        return Uint8Array.from([HEADER_VALUE_TYPE.byte, header.value]);
      case "short":
        const shortView = new DataView(new ArrayBuffer(3));
        shortView.setUint8(0, HEADER_VALUE_TYPE.short);
        shortView.setInt16(1, header.value, false);
        return new Uint8Array(shortView.buffer);
      case "integer":
        const intView = new DataView(new ArrayBuffer(5));
        intView.setUint8(0, HEADER_VALUE_TYPE.integer);
        intView.setInt32(1, header.value, false);
        return new Uint8Array(intView.buffer);
      case "long":
        const longBytes = new Uint8Array(9);
        longBytes[0] = HEADER_VALUE_TYPE.long;
        longBytes.set(header.value.bytes, 1);
        return longBytes;
      case "binary":
        const binView = new DataView(new ArrayBuffer(3 + header.value.byteLength));
        binView.setUint8(0, HEADER_VALUE_TYPE.byteArray);
        binView.setUint16(1, header.value.byteLength, false);
        const binBytes = new Uint8Array(binView.buffer);
        binBytes.set(header.value, 3);
        return binBytes;
      case "string":
        const utf8Bytes = fromUtf8(header.value);
        const strView = new DataView(new ArrayBuffer(3 + utf8Bytes.byteLength));
        strView.setUint8(0, HEADER_VALUE_TYPE.string);
        strView.setUint16(1, utf8Bytes.byteLength, false);
        const strBytes = new Uint8Array(strView.buffer);
        strBytes.set(utf8Bytes, 3);
        return strBytes;
      case "timestamp":
        const tsBytes = new Uint8Array(9);
        tsBytes[0] = HEADER_VALUE_TYPE.timestamp;
        tsBytes.set(Int64.fromNumber(header.value.valueOf()).bytes, 1);
        return tsBytes;
      case "uuid":
        if (!UUID_PATTERN.test(header.value)) {
          throw new Error(`Invalid UUID received: ${header.value}`);
        }
        const uuidBytes = new Uint8Array(17);
        uuidBytes[0] = HEADER_VALUE_TYPE.uuid;
        uuidBytes.set(fromHex(header.value.replace(/\-/g, "")), 1);
        return uuidBytes;
    }
  }
}

const enum HEADER_VALUE_TYPE {
  boolTrue = 0,
  boolFalse,
  byte,
  short,
  integer,
  long,
  byteArray,
  string,
  timestamp,
  uuid,
}

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/**
 * TODO: duplicated from @smithy/eventstream-codec to break large dependency.
 * TODO: This should be moved to its own deduped submodule in @smithy/core when submodules are implemented.
 */
export class Int64 implements IInt64 {
  constructor(readonly bytes: Uint8Array) {
    if (bytes.byteLength !== 8) {
      throw new Error("Int64 buffers must be exactly 8 bytes");
    }
  }

  static fromNumber(number: number): Int64 {
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    if (number > 9_223_372_036_854_775_807 || number < -9_223_372_036_854_775_808) {
      throw new Error(`${number} is too large (or, if negative, too small) to represent as an Int64`);
    }

    const bytes = new Uint8Array(8);
    for (let i = 7, remaining = Math.abs(Math.round(number)); i > -1 && remaining > 0; i--, remaining /= 256) {
      bytes[i] = remaining;
    }

    if (number < 0) {
      negate(bytes);
    }

    return new Int64(bytes);
  }

  /**
   * Called implicitly by infix arithmetic operators.
   */
  valueOf(): number {
    const bytes = this.bytes.slice(0);
    const negative = bytes[0] & 0b10000000;
    if (negative) {
      negate(bytes);
    }

    return parseInt(toHex(bytes), 16) * (negative ? -1 : 1);
  }

  toString() {
    return String(this.valueOf());
  }
}

function negate(bytes: Uint8Array): void {
  for (let i = 0; i < 8; i++) {
    bytes[i] ^= 0xff;
  }

  for (let i = 7; i > -1; i--) {
    bytes[i]++;
    if (bytes[i] !== 0) break;
  }
}
