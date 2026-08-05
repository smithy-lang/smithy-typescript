import { describe, expect, it, vi } from "vitest";

import { FALLBACK_LOGGER } from "../fallbackLogger";
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
    it("offers the client logger to the handler under the fallback key", () => {
      const handler = createMockHandler();
      const logger = createMockLogger();

      getHttpHandlerExtensionConfiguration({ httpHandler: handler, logger } as any);

      expect(handler.updateHttpClientConfig).toHaveBeenCalledWith(FALLBACK_LOGGER, logger);
    });

    it("does not assign the public logger key, so an explicit handler logger is never overwritten", () => {
      const handler = createMockHandler();
      const logger = createMockLogger();

      getHttpHandlerExtensionConfiguration({ httpHandler: handler, logger } as any);

      expect(handler.updateHttpClientConfig).not.toHaveBeenCalledWith("logger", expect.anything());
      expect(handler.updateHttpClientConfig).toHaveBeenCalledTimes(1);
    });

    it("does not call updateHttpClientConfig when logger is not set", () => {
      const handler = createMockHandler();

      getHttpHandlerExtensionConfiguration({ httpHandler: handler } as any);

      expect(handler.updateHttpClientConfig).not.toHaveBeenCalled();
    });

    it("does not throw when no handler is present", () => {
      const logger = createMockLogger();

      // should not throw
      getHttpHandlerExtensionConfiguration({ logger } as any);
    });

    it("does not throw for a handler that predates updateHttpClientConfig", () => {
      const logger = createMockLogger();
      const legacyHandler = { metadata: {}, handle: vi.fn() };

      // should not throw
      getHttpHandlerExtensionConfiguration({ httpHandler: legacyHandler, logger } as any);
    });
  });
});
