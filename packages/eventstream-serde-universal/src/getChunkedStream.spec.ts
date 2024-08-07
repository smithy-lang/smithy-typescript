import { Readable, ReadableOptions } from "stream";

import { getChunkedStream } from "./getChunkedStream";

export const recordEventMessage = Buffer.from(
  "AAAA0AAAAFX31gVLDTptZXNzYWdlLXR5cGUHAAVldmVudAs6ZXZlbnQtdHlwZQcAB1JlY29yZHMNOmNvbnRlbnQtdHlwZQcAGGFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbTEsRm9vLFdoZW4gbGlmZSBnaXZlcyB5b3UgZm9vLi4uCjIsQmFyLG1ha2UgQmFyIQozLEZpenosU29tZXRpbWVzIHBhaXJlZCB3aXRoLi4uCjQsQnV6eix0aGUgaW5mYW1vdXMgQnV6eiEKzxKeSw==",
  "base64"
);

export const statsEventMessage = Buffer.from(
  "AAAA0QAAAEM+YpmqDTptZXNzYWdlLXR5cGUHAAVldmVudAs6ZXZlbnQtdHlwZQcABVN0YXRzDTpjb250ZW50LXR5cGUHAAh0ZXh0L3htbDxTdGF0cyB4bWxucz0iIj48Qnl0ZXNTY2FubmVkPjEyNjwvQnl0ZXNTY2FubmVkPjxCeXRlc1Byb2Nlc3NlZD4xMjY8L0J5dGVzUHJvY2Vzc2VkPjxCeXRlc1JldHVybmVkPjEwNzwvQnl0ZXNSZXR1cm5lZD48L1N0YXRzPiJ0pLk=",
  "base64"
);

export const endEventMessage = Buffer.from(
  "AAAAOAAAACjBxoTUDTptZXNzYWdlLXR5cGUHAAVldmVudAs6ZXZlbnQtdHlwZQcAA0VuZM+X05I=",
  "base64"
);

export const exception = Buffer.from(
  "AAAAtgAAAF8BcW64DTpjb250ZW50LXR5cGUHABhhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0NOm1lc3NhZ2UtdHlwZQcACWV4Y2VwdGlvbg86ZXhjZXB0aW9uLXR5cGUHAAlFeGNlcHRpb25UaGlzIGlzIGEgbW9kZWxlZCBleGNlcHRpb24gZXZlbnQgdGhhdCB3b3VsZCBiZSB0aHJvd24gaW4gZGVzZXJpYWxpemVyLj6Gc60=",
  "base64"
);

export interface MockEventMessageSourceOptions extends ReadableOptions {
  messages: Array<Buffer>;
  emitSize: number;
  throwError?: Error;
}

export class MockEventMessageSource extends Readable {
  private readonly data: Buffer;
  private readonly emitSize: number;
  private readonly throwError?: Error;
  private readCount = 0;
  constructor(options: MockEventMessageSourceOptions) {
    super(options);
    this.data = Buffer.concat(options.messages);
    this.emitSize = options.emitSize;
    this.throwError = options.throwError;
  }

  _read() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    if (this.readCount === this.data.length) {
      if (this.throwError) {
        process.nextTick(function () {
          self.emit("error", new Error("Throwing an error!"));
        });
        return;
      } else {
        this.push(null);
        return;
      }
    }

    const bytesLeft = this.data.length - this.readCount;
    const numBytesToSend = Math.min(bytesLeft, this.emitSize);

    const chunk = this.data.slice(this.readCount, this.readCount + numBytesToSend);
    this.readCount += numBytesToSend;
    this.push(chunk);
  }
}

describe("getChunkedStream", () => {
  it("splits payloads into individual messages", async () => {
    const messages = [];
    const mockMessages = [recordEventMessage, statsEventMessage, endEventMessage];
    const mockStream = new MockEventMessageSource({
      messages: mockMessages,
      emitSize: 100,
    });
    const chunkerStream = getChunkedStream(mockStream);
    for await (const msg of chunkerStream) {
      messages.push(msg);
    }
    expect(messages.length).toBe(3);
  });

  it("splits payloads in correct order", async () => {
    const messages: Array<any> = [];
    const mockMessages = [recordEventMessage, statsEventMessage, recordEventMessage, endEventMessage];
    const mockStream = new MockEventMessageSource({
      messages: mockMessages,
      emitSize: 100,
    });
    const chunkerStream = getChunkedStream(mockStream);
    for await (const msg of chunkerStream) {
      messages.push(msg);
    }
    expect(messages.length).toBe(4);
    for (let i = 0; i < mockMessages.length; i++) {
      expect(Buffer.from(messages[i]).toString("base64")).toEqual(mockMessages[i].toString("base64"));
    }
  });

  it("splits payloads when received all at once", async () => {
    const messages = [];
    const mockMessages = [recordEventMessage, statsEventMessage, endEventMessage];
    const mockStream = new MockEventMessageSource({
      messages: mockMessages,
      emitSize: mockMessages.reduce((prev, cur) => {
        return prev + cur.length;
      }, 0),
    });
    const chunkerStream = getChunkedStream(mockStream);
    for await (const msg of chunkerStream) {
      messages.push(msg);
    }
    expect(messages.length).toBe(3);
  });

  it("splits payloads when total event message length spans multiple chunks", async () => {
    const messages = [];
    const mockMessages = [recordEventMessage, statsEventMessage, endEventMessage];
    const mockStream = new MockEventMessageSource({
      messages: mockMessages,
      emitSize: 1,
    });
    const chunkerStream = getChunkedStream(mockStream);
    for await (const msg of chunkerStream) {
      messages.push(msg);
    }
    expect(messages.length).toBe(3);
  });

  it("splits payloads when total event message length spans 2 chunks", async () => {
    const messages = [];
    const mockMessages = [recordEventMessage, statsEventMessage, endEventMessage];
    const mockStream = new MockEventMessageSource({
      messages: mockMessages,
      emitSize: recordEventMessage.length + 2,
    });
    const chunkerStream = getChunkedStream(mockStream);
    for await (const msg of chunkerStream) {
      messages.push(msg);
    }
    expect(messages.length).toBe(3);
  });

  it("sends an error if an event message is truncated", async () => {
    const responseMessage = Buffer.concat([recordEventMessage, statsEventMessage, endEventMessage]);
    const mockStream = new MockEventMessageSource({
      messages: [responseMessage.slice(0, responseMessage.length - 4)],
      emitSize: 10,
    });

    const chunkerStream = getChunkedStream(mockStream);
    let error: Error | undefined = undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const msg of chunkerStream) {
        //Pass
      }
    } catch (err) {
      error = err;
    }
    expect(error!.message).toEqual("Truncated event message received.");
  });
});
