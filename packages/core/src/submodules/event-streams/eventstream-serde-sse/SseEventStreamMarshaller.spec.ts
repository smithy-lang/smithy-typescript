import type { Message } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { SseEventStreamMarshaller } from "./SseEventStreamMarshaller";

const utf8Encoder = (bytes: Uint8Array) => Buffer.from(bytes).toString("utf-8");
const utf8Decoder = (str: string) => new Uint8Array(Buffer.from(str, "utf-8"));

const marshaller = new SseEventStreamMarshaller({ utf8Encoder, utf8Decoder });

async function* iterate<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of stream) {
    out.push(item);
  }
  return out;
}

type ChatEvent = { message: { text: string } } | { done: { reason: string } };

const serializer = (event: ChatEvent): Message => {
  const type = Object.keys(event)[0] as keyof ChatEvent;
  return {
    headers: {
      ":message-type": { type: "string", value: "event" },
      ":event-type": { type: "string", value: type },
      ":content-type": { type: "string", value: "application/json" },
    },
    body: utf8Decoder(JSON.stringify((event as any)[type])),
  };
};

const deserializer = async (input: Record<string, Message>): Promise<any> => {
  const type = Object.keys(input)[0];
  if (type === "message" || type === "done") {
    return { [type]: JSON.parse(utf8Encoder(input[type].body)) };
  }
  return { $unknown: [type, input[type]] };
};

describe("SseEventStreamMarshaller", () => {
  it("serializes events into text/event-stream frames", async () => {
    const frames = await collect(
      marshaller.serialize(iterate<ChatEvent>([{ message: { text: "hi" } }, { done: { reason: "stop" } }]), serializer)
    );
    const wire = frames.map(utf8Encoder).join("");
    expect(wire).toBe(
      `event: message\ndata: {"text":"hi"}\n\n` + `event: done\ndata: {"reason":"stop"}\n\n`
    );
  });

  it("round-trips events through serialize then deserialize", async () => {
    const events: ChatEvent[] = [{ message: { text: "one" } }, { message: { text: "two" } }, { done: { reason: "eof" } }];
    const wire = marshaller.serialize(iterate(events), serializer);
    const back = await collect(marshaller.deserialize(wire, deserializer));
    expect(back).toEqual(events);
  });

  it("handles payloads split across chunk boundaries", async () => {
    const wire = marshaller.serialize(iterate<ChatEvent>([{ message: { text: "chunked" } }]), serializer);
    const whole = utf8Encoder((await collect(wire))[0]);
    async function* byChar(): AsyncIterable<Uint8Array> {
      for (const ch of whole) {
        yield utf8Decoder(ch);
      }
    }
    const back = await collect(marshaller.deserialize(byChar(), deserializer));
    expect(back).toEqual([{ message: { text: "chunked" } }]);
  });

  it("splits raw-newline payloads across multiple data: lines and rejoins them", async () => {
    const rawBody = "line1\nline2";
    const rawSerializer = (): Message => ({
      headers: {
        ":message-type": { type: "string", value: "event" },
        ":event-type": { type: "string", value: "raw" },
        ":content-type": { type: "string", value: "text/plain" },
      },
      body: utf8Decoder(rawBody),
    });
    const rawDeserializer = async (input: Record<string, Message>): Promise<any> => {
      const type = Object.keys(input)[0];
      return type === "raw" ? { raw: utf8Encoder(input[type].body) } : { $unknown: [type, input[type]] };
    };
    const frame = utf8Encoder((await collect(marshaller.serialize(iterate([{} as any]), rawSerializer)))[0]);
    expect(frame.match(/data: /g)?.length).toBe(2);
    const back = await collect(
      marshaller.deserialize(marshaller.serialize(iterate([{} as any]), rawSerializer), rawDeserializer)
    );
    expect(back).toEqual([{ raw: rawBody }]);
  });

  it("round-trips CR and CRLF line terminators as LF", async () => {
    const rawSerializer = (input: any): Message => ({
      headers: {
        ":message-type": { type: "string", value: "event" },
        ":event-type": { type: "string", value: "raw" },
        ":content-type": { type: "string", value: "text/plain" },
      },
      body: utf8Decoder(input.raw),
    });
    const rawDeserializer = async (input: Record<string, Message>): Promise<any> => {
      const type = Object.keys(input)[0];
      return type === "raw" ? { raw: utf8Encoder(input[type].body) } : { $unknown: [type, input[type]] };
    };
    // SSE data: fields cannot preserve which terminator was used; all rejoin as LF.
    for (const [body, expected] of [
      ["a\rb", "a\nb"],
      ["a\r\nb", "a\nb"],
      ["a\nb", "a\nb"],
    ]) {
      const back = await collect(
        marshaller.deserialize(marshaller.serialize(iterate([{ raw: body }]), rawSerializer), rawDeserializer)
      );
      expect(back).toEqual([{ raw: expected }]);
    }
  });

  it("maps modeled exceptions to exception: events and throws on deserialize", async () => {
    const errSerializer = (): Message => ({
      headers: {
        ":message-type": { type: "string", value: "exception" },
        ":exception-type": { type: "string", value: "ThrottlingError" },
        ":content-type": { type: "string", value: "application/json" },
      },
      body: utf8Decoder(JSON.stringify({ message: "slow down" })),
    });
    const errDeserializer = async (input: Record<string, Message>): Promise<any> => {
      const type = Object.keys(input)[0];
      if (type === "ThrottlingError") {
        const parsed = JSON.parse(utf8Encoder(input[type].body));
        const e = new Error(parsed.message);
        e.name = "ThrottlingError";
        return { ThrottlingError: e };
      }
      return { $unknown: [type, input[type]] };
    };
    const wire = marshaller.serialize(iterate([{} as any]), errSerializer);
    const frame = utf8Encoder((await collect(wire))[0]);
    expect(frame.startsWith("event: exception:ThrottlingError\n")).toBe(true);

    await expect(
      collect(marshaller.deserialize(marshaller.serialize(iterate([{} as any]), errSerializer), errDeserializer))
    ).rejects.toThrow("slow down");
  });
});
