import { describe, expect, it, vi } from "vitest";

import { getHttpHandlerExtensionConfiguration } from "./httpExtensionConfiguration";

describe("getHttpHandlerExtensionConfiguration", () => {
  const createMockHandler = () => ({
    metadata: { handlerProtocol: "http/1.1" },
    handle: vi.fn(),
    updateHttpClientConfig: vi.fn(),
    httpHandlerConfigs: vi.fn().mockReturnValue({}),
  });

  const createMockLogger = () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });

  describe("client logger injection", () => {
    it("passes logger to httpHandler via updateHttpClientConfig", () => {
      const handler = createMockHandler();
      const logger = createMockLogger();

      getHttpHandlerExtensionConfiguration({ httpHandler: handler, logger } as any);

      expect(handler.updateHttpClientConfig).toHaveBeenCalledWith("logger", logger);
    });

    it("does not throw when no handler is present", () => {
      const logger = createMockLogger();

      // should not throw
      getHttpHandlerExtensionConfiguration({ logger } as any);
    });

    it("does not throw when no logger is provided", () => {
      const handler = createMockHandler();

      getHttpHandlerExtensionConfiguration({ httpHandler: handler } as any);

      expect(handler.updateHttpClientConfig).toHaveBeenCalledWith("logger", undefined);
    });
  });
});
