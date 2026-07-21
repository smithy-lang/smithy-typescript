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
    it("injects logger into requestHandler when logger is explicitly set", () => {
      const handler = createMockHandler();
      const logger = createMockLogger();

      getHttpHandlerExtensionConfiguration({ requestHandler: handler, logger } as any);

      expect(handler.updateHttpClientConfig).toHaveBeenCalledWith("logger", logger);
    });

    it("injects logger into httpHandler when requestHandler is absent", () => {
      const handler = createMockHandler();
      const logger = createMockLogger();

      getHttpHandlerExtensionConfiguration({ httpHandler: handler, logger } as any);

      expect(handler.updateHttpClientConfig).toHaveBeenCalledWith("logger", logger);
    });

    it("prefers httpHandler over requestHandler", () => {
      const httpHandler = createMockHandler();
      const requestHandler = createMockHandler();
      const logger = createMockLogger();

      getHttpHandlerExtensionConfiguration({ httpHandler, requestHandler, logger } as any);

      expect(httpHandler.updateHttpClientConfig).toHaveBeenCalledWith("logger", logger);
      expect(requestHandler.updateHttpClientConfig).not.toHaveBeenCalled();
    });

    it("does not inject NoOpLogger", () => {
      const handler = createMockHandler();

      class NoOpLogger {
        trace() {}
        debug() {}
        info() {}
        warn() {}
        error() {}
      }

      getHttpHandlerExtensionConfiguration({ requestHandler: handler, logger: new NoOpLogger() } as any);

      expect(handler.updateHttpClientConfig).not.toHaveBeenCalled();
    });

    it("does not inject when no logger is provided", () => {
      const handler = createMockHandler();

      getHttpHandlerExtensionConfiguration({ requestHandler: handler } as any);

      expect(handler.updateHttpClientConfig).not.toHaveBeenCalled();
    });

    it("does not inject when no handler is present", () => {
      const logger = createMockLogger();

      // should not throw
      getHttpHandlerExtensionConfiguration({ logger } as any);
    });
  });
});
