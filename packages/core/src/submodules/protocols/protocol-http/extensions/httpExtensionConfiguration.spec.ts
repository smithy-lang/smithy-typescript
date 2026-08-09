import { describe, expect, it, vi } from "vitest";

import { FALLBACK_LOGGER } from "../fallbackLogger";
import { getHttpHandlerExtensionConfiguration, resolveHttpHandlerRuntimeConfig } from "./httpExtensionConfiguration";

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

  /**
   * Stands in for the client's NoOpLogger, which is detected by constructor
   * name to avoid a cross-submodule import.
   */
  class NoOpLogger {
    public trace = vi.fn();
    public debug = vi.fn();
    public info = vi.fn();
    public warn = vi.fn();
    public error = vi.fn();
  }

  describe("client logger injection", () => {
    it("offers the client logger to the handler under the fallback key", () => {
      const handler = createMockHandler();
      const logger = createMockLogger();

      getHttpHandlerExtensionConfiguration({ requestHandler: handler, logger } as any);

      expect(handler.updateHttpClientConfig).toHaveBeenCalledWith(FALLBACK_LOGGER, logger);
    });

    it("does not assign the public logger key, so an explicit handler logger is never overwritten", () => {
      const handler = createMockHandler();
      const logger = createMockLogger();

      getHttpHandlerExtensionConfiguration({ requestHandler: handler, logger } as any);

      expect(handler.updateHttpClientConfig).not.toHaveBeenCalledWith("logger", expect.anything());
      expect(handler.updateHttpClientConfig).toHaveBeenCalledTimes(1);
    });

    it("does not call updateHttpClientConfig when logger is not set", () => {
      const handler = createMockHandler();

      getHttpHandlerExtensionConfiguration({ requestHandler: handler } as any);

      expect(handler.updateHttpClientConfig).not.toHaveBeenCalled();
    });

    it("does not offer a NoOpLogger, so handlers keep their console defaults", () => {
      const handler = createMockHandler();

      getHttpHandlerExtensionConfiguration({ requestHandler: handler, logger: new NoOpLogger() } as any);

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
      getHttpHandlerExtensionConfiguration({ requestHandler: legacyHandler, logger } as any);
    });
  });

  describe("handler accessors read and write requestHandler", () => {
    it("returns the handler that clients populate as requestHandler", () => {
      const handler = createMockHandler();

      const extension = getHttpHandlerExtensionConfiguration({ requestHandler: handler } as any);

      expect(extension.httpHandler()).toBe(handler);
    });

    it("setHttpHandler replaces the handler seen by the runtime config", () => {
      const handler = createMockHandler();
      const replacement = createMockHandler();
      const runtimeConfig = { requestHandler: handler } as any;

      const extension = getHttpHandlerExtensionConfiguration(runtimeConfig);
      extension.setHttpHandler(replacement as any);

      expect(runtimeConfig.requestHandler).toBe(replacement);
      expect(extension.httpHandler()).toBe(replacement);
    });

    it("forwards updateHttpClientConfig and httpHandlerConfigs to the handler", () => {
      const handler = createMockHandler();

      const extension = getHttpHandlerExtensionConfiguration({ requestHandler: handler } as any);
      extension.updateHttpClientConfig("requestTimeout" as any, 1000 as any);
      extension.httpHandlerConfigs();

      expect(handler.updateHttpClientConfig).toHaveBeenCalledWith("requestTimeout", 1000);
      expect(handler.httpHandlerConfigs).toHaveBeenCalled();
    });
  });
});

describe("resolveHttpHandlerRuntimeConfig", () => {
  it("emits the handler under requestHandler, matching what clients read", () => {
    const handler = { metadata: {}, handle: vi.fn() } as any;

    const runtimeConfig = resolveHttpHandlerRuntimeConfig({
      httpHandler: () => handler,
    } as any);

    expect(runtimeConfig).toEqual({ requestHandler: handler });
  });
});
