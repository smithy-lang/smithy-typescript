import { normalizeProvider } from "@smithy/util-middleware";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { resolveCustomEndpointsConfig } from "./resolveCustomEndpointsConfig";

vi.mock("@smithy/util-middleware");

describe(resolveCustomEndpointsConfig.name, () => {
  const mockEndpoint = {
    protocol: "http:",
    hostname: "localhost",
    path: "/",
  };

  const mockInput = {
    endpoint: mockEndpoint,
    urlParser: vi.fn(() => mockEndpoint),
    useDualstackEndpoint: () => Promise.resolve(false),
  } as any;

  beforeEach(() => {
    vi.mocked(normalizeProvider).mockImplementation((input) =>
      typeof input === "function" ? (input as any) : () => Promise.resolve(input)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maintains object custody", () => {
    const input = { ...mockInput };
    expect(resolveCustomEndpointsConfig(input)).toBe(input);
  });

  describe("tls", () => {
    afterEach(() => {
      expect(normalizeProvider).toHaveBeenCalledTimes(2);
      expect(normalizeProvider).toHaveBeenNthCalledWith(2, mockInput.useDualstackEndpoint);
    });

    it.each([true, false])("returns %s when the value is passed", (tls) => {
      expect(resolveCustomEndpointsConfig({ ...mockInput, tls }).tls).toStrictEqual(tls);
    });

    it("returns true if input.tls is undefined", () => {
      expect(resolveCustomEndpointsConfig({ ...mockInput }).tls).toStrictEqual(true);
    });
  });

  it("returns true for isCustomEndpoint", () => {
    expect(resolveCustomEndpointsConfig({ ...mockInput }).isCustomEndpoint).toStrictEqual(true);
  });

  it("returns false when useDualstackEndpoint is not defined", async () => {
    const useDualstackEndpoint = await resolveCustomEndpointsConfig({
      ...mockInput,
      useDualstackEndpoint: undefined,
    }).useDualstackEndpoint();
    expect(useDualstackEndpoint).toStrictEqual(false);
  });

  describe("returns normalized endpoint", () => {
    it("calls urlParser endpoint is of type string", async () => {
      const mockEndpointString = "http://localhost/";
      const endpoint = await resolveCustomEndpointsConfig({ ...mockInput, endpoint: mockEndpointString }).endpoint();
      expect(endpoint).toStrictEqual(mockEndpoint);
      expect(mockInput.urlParser).toHaveBeenCalledWith(mockEndpointString);

      expect(normalizeProvider).toHaveBeenCalledTimes(2);
      expect(normalizeProvider).toHaveBeenNthCalledWith(1, mockInput.endpoint);
      expect(normalizeProvider).toHaveBeenNthCalledWith(2, mockInput.useDualstackEndpoint);
    });

    it("passes endpoint to normalize if not string", async () => {
      const endpoint = await resolveCustomEndpointsConfig({ ...mockInput }).endpoint();
      expect(endpoint).toStrictEqual(mockEndpoint);
      expect(mockInput.urlParser).not.toHaveBeenCalled();

      expect(normalizeProvider).toHaveBeenCalledTimes(2);
      expect(normalizeProvider).toHaveBeenNthCalledWith(1, mockInput.endpoint);
      expect(normalizeProvider).toHaveBeenNthCalledWith(2, mockInput.useDualstackEndpoint);
    });
  });
});
