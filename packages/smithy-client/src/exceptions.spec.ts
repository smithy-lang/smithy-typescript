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

describe("Exception Hierarchy Tests", () => {
  // test classes to represent the hierarchy
  class ClientServiceException extends ServiceException {
    constructor() {
      super({
        name: "ClientServiceException",
        $fault: "client",
        $metadata: {},
      });
      Object.setPrototypeOf(this, ClientServiceException.prototype);
    }
  }

  class ModeledClientServiceException extends ClientServiceException {
    constructor() {
      super();
      this.name = "ModeledClientServiceException";
      Object.setPrototypeOf(this, ModeledClientServiceException.prototype);
    }
  }

  describe("Empty Object Tests", () => {
    it("empty object should not be instanceof any exception", () => {
      expect({} instanceof Error).toBe(false);
      expect({} instanceof ServiceException).toBe(false);
      expect({} instanceof ClientServiceException).toBe(false);
      expect({} instanceof ModeledClientServiceException).toBe(false);
    });
  });

  describe("Error Instance Tests", () => {
    const error = new Error();
    it("Error instance should only be instanceof Error", () => {
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ServiceException).toBe(false);
      expect(error instanceof ClientServiceException).toBe(false);
      expect(error instanceof ModeledClientServiceException).toBe(false);
    });
  });

  describe("ServiceException Instance Tests", () => {
    const serviceException = new ServiceException({
      name: "ServiceException",
      $fault: "client",
      $metadata: {},
    });

    it("ServiceException instance should be instanceof Error and ServiceException", () => {
      expect(serviceException instanceof Error).toBe(true);
      expect(serviceException instanceof ServiceException).toBe(true);
      expect(serviceException instanceof ClientServiceException).toBe(false);
      expect(serviceException instanceof ModeledClientServiceException).toBe(false);
    });
  });

  describe("ClientServiceException Instance Tests", () => {
    const clientException = new ClientServiceException();
    it("ClientServiceException instance should be instanceof Error, ServiceException, and ClientServiceException", () => {
      expect(clientException instanceof Error).toBe(true);
      expect(clientException instanceof ServiceException).toBe(true);
      expect(clientException instanceof ClientServiceException).toBe(true);
      expect(clientException instanceof ModeledClientServiceException).toBe(false);
    });
  });

  describe("ModeledClientServiceException Instance Tests", () => {
    const modeledException = new ModeledClientServiceException();
    it("ModeledClientServiceException instance should be instanceof Error, ServiceException, ClientServiceException, and ModeledClientServiceException", () => {
      expect(modeledException instanceof Error).toBe(true);
      expect(modeledException instanceof ServiceException).toBe(true);
      expect(modeledException instanceof ClientServiceException).toBe(true);
      expect(modeledException instanceof ModeledClientServiceException).toBe(true);
    });
  });

  describe("Duck-Typed Object Tests", () => {
    it("object with only name should not be instanceof any exception", () => {
      const obj = { name: "Error" };
      expect(obj instanceof Error).toBe(false);
      expect(obj instanceof ServiceException).toBe(false);
      expect(obj instanceof ClientServiceException).toBe(false);
      expect(obj instanceof ModeledClientServiceException).toBe(false);
    });

    it("object with only $-props should be instanceof ServiceException", () => {
      const obj = { $fault: "client" as const, $metadata: {} };
      expect(obj instanceof Error).toBe(false);
      expect(obj instanceof ServiceException).toBe(true);
      expect(obj instanceof ClientServiceException).toBe(false);
      expect(obj instanceof ModeledClientServiceException).toBe(false);
    });

    it("object with ServiceException name and $-props should be instanceof ServiceException only", () => {
      const obj = { name: "ServiceException", $fault: "client" as const, $metadata: {} };
      expect(obj instanceof Error).toBe(false);
      expect(obj instanceof ServiceException).toBe(true);
      expect(obj instanceof ClientServiceException).toBe(false);
      expect(obj instanceof ModeledClientServiceException).toBe(false);
    });

    it("object with ClientServiceException name and $-props should be instanceof ServiceException and ClientServiceException", () => {
      const obj = { name: "ClientServiceException", $fault: "client" as const, $metadata: {} };
      expect(obj instanceof Error).toBe(false);
      expect(obj instanceof ServiceException).toBe(true);
      expect(obj instanceof ClientServiceException).toBe(true);
      expect(obj instanceof ModeledClientServiceException).toBe(false);
    });

    it("object with ModeledClientServiceException name and $-props should be instanceof ServiceException and ModeledClientServiceException", () => {
      const obj = { name: "ModeledClientServiceException", $fault: "client" as const, $metadata: {} };
      expect(obj instanceof Error).toBe(false);
      expect(obj instanceof ServiceException).toBe(true);
      expect(obj instanceof ClientServiceException).toBe(false);
      expect(obj instanceof ModeledClientServiceException).toBe(true);
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
