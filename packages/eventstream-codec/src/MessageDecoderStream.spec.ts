import { Message } from "@smithy/types";
import { describe, expect, test as it, vi } from "vitest";

import { MessageDecoderStream } from "./MessageDecoderStream";

describe("MessageDecoderStream", () => {
  it("returns decoded messages", async () => {
    const message1 = {
      headers: {},
      body: new Uint8Array(1),
    };

    const message2 = {
      headers: {},
      body: new Uint8Array(2),
    };

    const messageDecoderMock = {
      decode: vi.fn().mockReturnValueOnce(message1).mockReturnValueOnce(message2),
      feed: vi.fn(),
      endOfStream: vi.fn(),
      getMessage: vi.fn(),
      getAvailableMessages: vi.fn(),
    };

    const inputStream = async function* () {
      yield new Uint8Array(0);
      yield new Uint8Array(1);
    };

    const messageDecoderStream = new MessageDecoderStream({
      decoder: messageDecoderMock,
      inputStream: inputStream(),
    });

    const messages: Array<Message> = [];
    for await (const message of messageDecoderStream) {
      messages.push(message);
    }
    expect(messages.length).toEqual(2);
    expect(messages[0]).toEqual(message1);
    expect(messages[1]).toEqual(message2);
  });
});
