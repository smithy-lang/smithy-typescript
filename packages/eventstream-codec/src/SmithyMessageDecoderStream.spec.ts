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

    const deserializer = jest
      .fn()
      .mockReturnValueOnce(Promise.resolve("first"))
      .mockReturnValueOnce(Promise.resolve("second"));

    const inputStream = async function* () {
      yield message1;
      yield message2;
    };

    const stream = new SmithyMessageDecoderStream<String>({
      messageStream: inputStream(),
      deserializer: deserializer,
    });

    const messages: Array<String> = [];
    for await (const str of stream) {
      messages.push(str);
    }
    expect(messages.length).toEqual(2);
    expect(messages[0]).toEqual("first");
    expect(messages[1]).toEqual("second");
  });

  it("is bufferable", async () => {
    const stream = new SmithyMessageDecoderStream({
      deserializer: (_) => _ as any,
      messageStream: [1, 2, 3, 4, 5] as any,
    });

    stream.push(10);
    stream.unshift(9);

    const it = stream[Symbol.asyncIterator]();

    expect(await it.next()).toEqual({ value: 9, done: false });
    expect(await it.next()).toEqual({ value: 10, done: false });
    expect(await it.next()).toEqual({ value: 1, done: false });
    expect(await it.next()).toEqual({ value: 2, done: false });

    stream.push(11);
    expect(await it.next()).toEqual({ value: 11, done: false });

    expect(await it.next()).toEqual({ value: 3, done: false });
    expect(await it.next()).toEqual({ value: 4, done: false });
    expect(await it.next()).toEqual({ value: 5, done: false });
    expect(await it.next()).toEqual({ value: undefined, done: true });
  });
});
