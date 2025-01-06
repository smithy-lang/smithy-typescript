import { describe, expect, test as it } from "vitest";

import { decorateServiceException, ExceptionOptionType, ServiceException } from "./exceptions";

it("ServiceException extends from Error", () => {
  expect(
    new ServiceException({
      name: "Error",
      message: "",
      $fault: "client",
      $metadata: {},
    })
  ).toBeInstanceOf(Error);
});

it("ExceptionOptionType allows specifying message", () => {
  class SomeException extends ServiceException {
    readonly code: string;
    constructor(opts: ExceptionOptionType<SomeException, ServiceException>) {
      super({
        name: "SomeException",
        $fault: "client",
        ...opts,
      });
      this.code = opts.code;
    }
  }
  const exception = new SomeException({
    message: "message",
    code: "code",
    $metadata: {},
  });
  expect(exception.message).toBe("message");
  expect(exception.code).toBe("code");
});

describe("ServiceException type checking", () => {
  class TestServiceException extends ServiceException {
    constructor() {
      super({
        name: "TestServiceException",
        $fault: "client",
        $metadata: {},
      });
      Object.setPrototypeOf(this, TestServiceException.prototype);
    }
  }

  const baseError = new ServiceException({
    name: "Error",
    $fault: "client",
    $metadata: {},
  });

  const subclassError = new TestServiceException();

  const duckTyped = {
    $fault: "server",
    $metadata: {},
  };

  describe("isInstance", () => {
    it("should return true for ServiceException instances", () => {
      expect(ServiceException.isInstance(baseError)).toBe(true);
    });

    it("should return true for duck-typed objects", () => {
      expect(ServiceException.isInstance(duckTyped)).toBe(true);
    });

    it("should return false for null or undefined", () => {
      expect(ServiceException.isInstance(null)).toBe(false);
      expect(ServiceException.isInstance(undefined)).toBe(false);
    });

    it("should return false for invalid $fault values", () => {
      expect(ServiceException.isInstance({ $fault: "invalid", $metadata: {} })).toBe(false);
    });

    it("should return false for missing properties", () => {
      expect(ServiceException.isInstance({ $fault: "client" })).toBe(false);
      expect(ServiceException.isInstance({ $metadata: {} })).toBe(false);
    });
  });

  describe("instanceof operator", () => {
    it("should return true for ServiceException base class with actual instances", () => {
      expect(baseError instanceof ServiceException).toBe(true);
      expect(subclassError instanceof ServiceException).toBe(true);
    });

    it("should return true for ServiceException base class with duck-typed objects", () => {
      expect(duckTyped instanceof ServiceException).toBe(true);
    });

    it("should handle subclass instanceof checks correctly", () => {
      expect(subclassError instanceof TestServiceException).toBe(true);
      expect(baseError instanceof TestServiceException).toBe(false);
      expect(duckTyped instanceof TestServiceException).toBe(false);
    });

    it("should prevent duck-typed objects from matching subclass instanceof checks", () => {
      const dummyServiceException = new ServiceException({
        name: "TEST_ERROR",
        message: "TEST_MESSAGE",
        $fault: "server",
        $metadata: {},
      });

      class SpecificError extends ServiceException {
        constructor() {
          super({
            name: "SpecificError",
            $fault: "client",
            $metadata: {},
          });
        }
      }

      expect(dummyServiceException instanceof SpecificError).toBe(false);
    });
  });
});

describe("decorateServiceException", () => {
  const exception = new ServiceException({
    name: "Error",
    message: "Error",
    $fault: "client",
    $metadata: {},
  });

  it("should inject unmodeled members to the exception", () => {
    const decorated = decorateServiceException(exception, { foo: "foo" });
    expect((decorated as any).foo).toBe("foo");
  });

  it("should not inject unmodeled members to the undefined", () => {
    const decorated = decorateServiceException(exception, { message: undefined });
    expect(decorated.message).toBe("Error");
  });

  it("should not overwrite the parsed exceptions", () => {
    const decorated = decorateServiceException(exception, { message: "Another Error" });
    expect(decorated.message).toBe("Error");
  });

  it("should replace Message with message", () => {
    const decorated = decorateServiceException({
      name: "Error",
      Message: "message",
    } as any);
    expect(decorated.message).toBe("message");
  });
});
