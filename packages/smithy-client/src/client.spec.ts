import { beforeEach, describe, expect, test as it, vi } from "vitest";

import { Client } from "./client";

describe("SmithyClient", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockHandler = vi.fn((args: any) => Promise.resolve({ output: "foo" }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockResolveMiddleware = vi.fn((args) => mockHandler);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getCommandWithOutput = (output: string) => ({
    resolveMiddleware: mockResolveMiddleware,
  });
  const client = new Client({ cacheMiddleware: true } as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return response promise when only command is supplied", async () => {
    expect.assertions(1);
    await expect(client.send(getCommandWithOutput("foo") as any)).resolves.toEqual("foo");
  });

  it("should return response promise when command and options is supplied", async () => {
    expect.assertions(3);
    const options = {
      AbortSignal: "bar",
    };
    await expect(client.send(getCommandWithOutput("foo") as any, options)).resolves.toEqual("foo");
    expect(mockResolveMiddleware.mock.calls.length).toEqual(1);
    expect(mockResolveMiddleware.mock.calls[0][2 as any]).toEqual(options);
  });

  it("should apply callback when command and callback is supplied", async () => {
    let resolve: Function;
    const promise = new Promise((r) => (resolve = r));
    const callback = vi.fn((err, response) => {
      expect(response).toEqual("foo");
      resolve();
    });
    client.send(getCommandWithOutput("foo") as any, callback);
    await promise;
  });

  it("should apply callback when command, options and callback is supplied", async () => {
    let resolve: Function;
    const promise = new Promise((r) => (resolve = r));
    const callback = vi.fn((err, response) => {
      expect(response).toEqual("foo");
      expect(mockResolveMiddleware.mock.calls.length).toEqual(1);
      expect(mockResolveMiddleware.mock.calls[0][2 as any]).toEqual(options);
      resolve();
    });
    const options = {
      AbortSignal: "bar",
    };
    client.send(getCommandWithOutput("foo") as any, options, callback);
    await promise;
  });

  describe("handler caching", () => {
    beforeEach(() => {
      delete (client as any).handlers;
    });

    const privateAccess = () => (client as any).handlers;

    it("should cache the resolved handler", async () => {
      await expect(client.send(getCommandWithOutput("foo") as any)).resolves.toEqual("foo");
      expect(privateAccess().get({}.constructor)).toBeDefined();
    });

    it("should not cache the resolved handler if called with request options", async () => {
      await expect(client.send(getCommandWithOutput("foo") as any, {})).resolves.toEqual("foo");
      expect(privateAccess()).toBeUndefined();
    });

    it("unsets the cache if client.destroy() is called.", async () => {
      await expect(client.send(getCommandWithOutput("foo") as any)).resolves.toEqual("foo");
      client.destroy();
      expect(privateAccess()).toBeUndefined();
    });
  });
});
