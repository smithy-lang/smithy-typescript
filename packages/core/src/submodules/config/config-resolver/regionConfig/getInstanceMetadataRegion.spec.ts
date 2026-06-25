import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import type { getInstanceMetadataRegion as GetInstanceMetadataRegion } from "./getInstanceMetadataRegion";

const requestMock = vi.fn();
vi.mock("node:http", () => ({
  request: requestMock,
}));

interface FakeReqInit {
  body?: string;
  statusCode?: number;
  error?: Error;
}

class FakeReq extends EventEmitter {
  end = vi.fn();
  destroy = vi.fn();
}

class FakeRes extends EventEmitter {
  statusCode: number;
  constructor(statusCode: number) {
    super();
    this.statusCode = statusCode;
  }
}

const fakeRequest = (init: FakeReqInit) =>
  vi.fn(() => {
    const req = new FakeReq();
    queueMicrotask(() => {
      if (init.error) {
        req.emit("error", init.error);
        return;
      }
      const res = new FakeRes(init.statusCode ?? 200);
      req.emit("response", res);
      queueMicrotask(() => {
        if (init.body !== undefined) {
          res.emit("data", Buffer.from(init.body));
        }
        res.emit("end");
      });
    });
    return req;
  });

describe("getInstanceMetadataRegion", () => {
  const originalEnv = process.env;

  let getInstanceMetadataRegion: typeof GetInstanceMetadataRegion;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.AWS_EC2_METADATA_DISABLED;
    delete process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT;
    delete process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE;
    requestMock.mockReset();
    ({ getInstanceMetadataRegion } = await import("./getInstanceMetadataRegion"));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns the region after a token PUT and region GET", async () => {
    requestMock
      .mockImplementationOnce(fakeRequest({ body: "imds-token", statusCode: 200 }))
      .mockImplementationOnce(fakeRequest({ body: "us-west-2", statusCode: 200 }));

    await expect(getInstanceMetadataRegion()).resolves.toBe("us-west-2");

    const tokenCall = requestMock.mock.calls[0][0];
    expect(tokenCall.method).toBe("PUT");
    expect(tokenCall.path).toBe("/latest/api/token");
    expect(tokenCall.headers).toMatchObject({ "x-aws-ec2-metadata-token-ttl-seconds": "21600" });

    const regionCall = requestMock.mock.calls[1][0];
    expect(regionCall.method).toBe("GET");
    expect(regionCall.path).toBe("/latest/meta-data/placement/region");
    expect(regionCall.headers).toMatchObject({ "x-aws-ec2-metadata-token": "imds-token" });
  });

  it("trims whitespace from the region response", async () => {
    requestMock
      .mockImplementationOnce(fakeRequest({ body: "tok", statusCode: 200 }))
      .mockImplementationOnce(fakeRequest({ body: "  us-east-1\n", statusCode: 200 }));

    await expect(getInstanceMetadataRegion()).resolves.toBe("us-east-1");
  });

  it("returns undefined when AWS_EC2_METADATA_DISABLED is set", async () => {
    process.env.AWS_EC2_METADATA_DISABLED = "true";

    await expect(getInstanceMetadataRegion()).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("returns undefined and caches negative result on token PUT error", async () => {
    requestMock.mockImplementationOnce(fakeRequest({ error: new Error("ECONNREFUSED") }));

    await expect(getInstanceMetadataRegion()).resolves.toBeUndefined();
    await expect(getInstanceMetadataRegion()).resolves.toBeUndefined();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("returns undefined on non-2xx response", async () => {
    requestMock.mockImplementationOnce(fakeRequest({ statusCode: 500, body: "" }));

    await expect(getInstanceMetadataRegion()).resolves.toBeUndefined();
  });

  it("returns undefined on empty region body", async () => {
    requestMock
      .mockImplementationOnce(fakeRequest({ body: "tok", statusCode: 200 }))
      .mockImplementationOnce(fakeRequest({ body: "", statusCode: 200 }));

    await expect(getInstanceMetadataRegion()).resolves.toBeUndefined();
  });

  it("uses AWS_EC2_METADATA_SERVICE_ENDPOINT host when set", async () => {
    process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT = "http://192.0.2.10/";
    requestMock
      .mockImplementationOnce(fakeRequest({ body: "tok", statusCode: 200 }))
      .mockImplementationOnce(fakeRequest({ body: "us-west-2", statusCode: 200 }));

    await getInstanceMetadataRegion();
    expect(requestMock.mock.calls[0][0].hostname).toBe("192.0.2.10");
  });

  it("preserves a non-default port from AWS_EC2_METADATA_SERVICE_ENDPOINT", async () => {
    process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT = "http://127.0.0.1:54321/";
    requestMock
      .mockImplementationOnce(fakeRequest({ body: "tok", statusCode: 200 }))
      .mockImplementationOnce(fakeRequest({ body: "us-west-2", statusCode: 200 }));

    await getInstanceMetadataRegion();
    expect(requestMock.mock.calls[0][0].hostname).toBe("127.0.0.1");
    expect(requestMock.mock.calls[0][0].port).toBe(54321);
  });

  it("uses IPv6 endpoint when AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE=IPv6", async () => {
    process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE = "IPv6";
    requestMock
      .mockImplementationOnce(fakeRequest({ body: "tok", statusCode: 200 }))
      .mockImplementationOnce(fakeRequest({ body: "us-west-2", statusCode: 200 }));

    await getInstanceMetadataRegion();
    expect(requestMock.mock.calls[0][0].hostname).toBe("fd00:ec2::254");
  });

  it("defaults to 169.254.169.254 when no endpoint env vars are set", async () => {
    requestMock
      .mockImplementationOnce(fakeRequest({ body: "tok", statusCode: 200 }))
      .mockImplementationOnce(fakeRequest({ body: "us-west-2", statusCode: 200 }));

    await getInstanceMetadataRegion();
    expect(requestMock.mock.calls[0][0].hostname).toBe("169.254.169.254");
  });
});
