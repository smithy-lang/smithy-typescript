import { describe, expect, test as it } from "vitest";

import { fromArrayBuffer, fromString } from "./buffer-from";

describe("fromArrayBuffer", () => {
  it("throws if argument is not an ArrayBuffer", () => {
    const input = 255;
    // @ts-expect-error is not assignable to parameter of type 'ArrayBuffer'
    expect(() => fromArrayBuffer(input)).toThrow(
      new TypeError(`The "input" argument must be ArrayBuffer. Received type ${typeof input} (${input})`)
    );
  });

  it("returns a Buffer from ArrayBuffer with one arg", () => {
    const buffer = new ArrayBuffer(16);
    const result = fromArrayBuffer(buffer);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.byteLength).toBe(16);
  });

  it("returns a Buffer from ArrayBuffer with offset", () => {
    const buffer = new ArrayBuffer(16);
    const offset = 4;
    const result = fromArrayBuffer(buffer, offset);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.byteLength).toBe(12);
  });

  it("returns a Buffer from ArrayBuffer with offset and length", () => {
    const buffer = new ArrayBuffer(16);
    const result = fromArrayBuffer(buffer, 4, 8);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.byteLength).toBe(8);
  });

  it("shares memory with the source ArrayBuffer", () => {
    const buffer = new ArrayBuffer(4);
    const view = new Uint8Array(buffer);
    view[0] = 42;
    const result = fromArrayBuffer(buffer);
    expect(result[0]).toBe(42);
  });
});

describe("fromString", () => {
  it("throws if argument is not a string", () => {
    const input = 255;
    // @ts-expect-error is not assignable to parameter of type 'string'
    expect(() => fromString(input)).toThrow(
      new TypeError(`The "input" argument must be of type string. Received type ${typeof input} (${input})`)
    );
  });

  it("returns a Buffer from string without encoding", () => {
    const result = fromString("hello");
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString("utf8")).toBe("hello");
  });

  it("returns a Buffer from string with encoding", () => {
    const result = fromString("68656c6c6f", "hex");
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString("utf8")).toBe("hello");
  });
});
