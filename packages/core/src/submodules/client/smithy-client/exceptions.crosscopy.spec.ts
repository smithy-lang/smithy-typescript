import { describe, expect, test as it } from "vitest";

import { ServiceException } from "./exceptions";

// Simulate two duplicate package copies of the same service's classes.
// Each copy has its own base class object, distinct from the other's.
const makeCopy = () => {
  class STSServiceException extends ServiceException {
    constructor(opts: any) {
      super(opts);
      Object.setPrototypeOf(this, STSServiceException.prototype);
    }
  }
  class ExpiredTokenException extends STSServiceException {
    readonly name = "ExpiredTokenException" as const;
    constructor(opts: any) {
      super({ name: "ExpiredTokenException", ...opts });
      Object.setPrototypeOf(this, ExpiredTokenException.prototype);
    }
  }
  return { STSServiceException, ExpiredTokenException };
};

describe("ServiceException cross-copy instanceof", () => {
  const clientCopy = makeCopy();
  const nestedCopy = makeCopy();

  const meta = { httpStatusCode: 400 } as any;
  const inst = new clientCopy.ExpiredTokenException({ $fault: "client", $metadata: meta });

  it("distinct class objects across copies", () => {
    expect(clientCopy.ExpiredTokenException).not.toBe(nestedCopy.ExpiredTokenException);
    expect(clientCopy.STSServiceException).not.toBe(nestedCopy.STSServiceException);
  });

  it("matches the same copy's own classes (prototype identity)", () => {
    expect(inst).toBeInstanceOf(clientCopy.ExpiredTokenException);
    expect(inst).toBeInstanceOf(clientCopy.STSServiceException);
  });

  it("matches the other copy's same-named modeled class (name arm)", () => {
    expect(inst).toBeInstanceOf(nestedCopy.ExpiredTokenException);
  });

  it("matches the other copy's BASE class via prototype-chain name walk", () => {
    expect(inst).toBeInstanceOf(nestedCopy.STSServiceException);
  });

  it("does not match an unrelated differently-named class", () => {
    class DynamoDBServiceException extends ServiceException {
      constructor(opts: any) {
        super(opts);
        Object.setPrototypeOf(this, DynamoDBServiceException.prototype);
      }
    }
    expect(inst).not.toBeInstanceOf(DynamoDBServiceException);
  });

  it("still matches the ServiceException root by duck type", () => {
    expect(inst).toBeInstanceOf(ServiceException);
  });
});
