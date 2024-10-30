import { describe, expect, test as it } from "vitest";

import { streamCollector } from "./stream-collector";

describe("streamCollector", () => {
  it("returns a Uint8Array from a blob", async () => {
    const expected = Uint8Array.from([102, 111, 111]);
    const dataPromise = new Response(expected.buffer).blob().then((blob) => streamCollector(blob));
    await dataPromise.then((data: any) => {
      expect(data).toEqual(expected);
    });
  });

  it("returns a Uint8Array from a ReadableStream", async () => {
    const expected = Uint8Array.from([102, 111, 111]);
    const dataPromise = streamCollector(new Response(expected.buffer).body);
    await dataPromise.then((data: any) => {
      expect(data).toEqual(expected);
    });
  });

  it("returns a Uint8Array when stream is empty", async () => {
    const expected = new Uint8Array(0);
    const dataPromise = streamCollector(new Response(expected.buffer).body);
    await dataPromise.then((data: any) => {
      expect(data).toEqual(expected);
    });
  });

  it("returns a Uint8Array when blob is empty", async () => {
    const expected = new Uint8Array(0);

    const dataPromise = new Response(expected.buffer).blob().then((blob) => streamCollector(blob));
    await dataPromise.then((data: any) => {
      expect(data).toEqual(expected);
    });
  });
});
