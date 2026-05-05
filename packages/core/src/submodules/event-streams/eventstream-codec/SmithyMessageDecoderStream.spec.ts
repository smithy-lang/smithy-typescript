import { describe, expect, test as it, vi } from "vitest";

import { SmithyMessageDecoderStream } from "./SmithyMessageDecoderStream";

describe("SmithyMessageDecoderStream", () => {
  it("returns decoded stream", async () => {
    const message1 = {
      headers: {},
      body: new Uint8Array(1),
    };

    const message2 = {
      headers: {},
      body: new Uint8Array(2),
    };

    const deserializer = vi
      .fn()
      .mockReturnValueOnce(Promise.resolve("first"))
      .mockReturnValueOnce(Promise.resolve("second"));

    const inputStream = async function* () {
      yield message1;
      yield message2;
    };

    const stream = new SmithyMessageDecoderStream<string>({
      messageStream: inputStream(),
      deserializer: deserializer,
    });

    const messages: Array<string> = [];
    for await (const str of stream) {
      messages.push(str);
    }
    expect(messages.length).toEqual(2);
    expect(messages[0]).toEqual("first");
    expect(messages[1]).toEqual("second");
  });
});
