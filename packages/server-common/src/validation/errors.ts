/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export class ServiceException extends Error {
  public static readonly shapeId: string = "smithy.ts.sdk.synthetic.nonamespace.server#ServiceException";
  readonly $fault: "client" | "server";

  constructor(options: { name: string; $fault: "client" | "server"; message?: string }) {
    super(options.message);
    Object.setPrototypeOf(this, ServiceException.prototype);
    this.name = options.name;
    this.$fault = options.$fault;
  }

  /**
   * Checks if a value is an instance of ServiceException (duck typed)
   */
  public static isInstance(value: unknown): value is ServiceException {
    if (!value) return false;
    const candidate = value as ServiceException;
    return (
      ServiceException.prototype.isPrototypeOf(candidate) ||
      (Boolean(candidate.$fault) && (candidate.$fault === "client" || candidate.$fault === "server"))
    );
  }

  /**
   * Custom instanceof check to support the operator for ServiceException base class
   */
  public static [Symbol.hasInstance](instance: unknown): boolean {
    if (!instance) {
      return false;
    }
    const candidate = instance as ServiceException;
    if (this === ServiceException) {
      return ServiceException.isInstance(instance);
    }
    if (ServiceException.isInstance(instance)) {
      if (this.prototype.isPrototypeOf(instance)) {
        return true;
      }

      const targetId: string | undefined = Object.prototype.hasOwnProperty.call(this, "shapeId")
        ? this.shapeId
        : undefined;
      if (targetId) {
        let proto = Object.getPrototypeOf(candidate);
        while (proto && proto !== Object.prototype) {
          const candidateId: string | undefined = Object.prototype.hasOwnProperty.call(proto.constructor, "shapeId")
            ? proto.constructor?.shapeId
            : undefined;
          if (candidateId && candidateId === targetId) {
            return true;
          }
          proto = Object.getPrototypeOf(proto);
        }
      }
    }
    return false;
  }
}

export type SmithyFrameworkException =
  | InternalFailureException
  | UnknownOperationException
  | SerializationException
  | UnsupportedMediaTypeException
  | NotAcceptableException
  | UnauthenticatedException;

export const isFrameworkException = (error: any): error is SmithyFrameworkException => {
  if (error == null || (typeof error !== "object" && typeof error !== "function")) {
    return false;
  }
  if (!error.hasOwnProperty("$frameworkError")) {
    return false;
  }
  return error.$frameworkError;
};

export class InternalFailureException {
  readonly name = "InternalFailure";
  readonly $fault = "server";
  readonly statusCode = 500;
  readonly $frameworkError = true;
}

export class UnknownOperationException {
  readonly name = "UnknownOperationException";
  readonly $fault = "client";
  readonly statusCode = 404;
  readonly $frameworkError = true;
}

export class SerializationException {
  readonly name = "SerializationException";
  readonly $fault = "client";
  readonly statusCode = 400;
  readonly $frameworkError = true;
}

export class UnsupportedMediaTypeException {
  readonly name = "UnsupportedMediaTypeException";
  readonly $fault = "client";
  readonly statusCode = 415;
  readonly $frameworkError = true;
}

export class NotAcceptableException {
  readonly name = "NotAcceptableException";
  readonly $fault = "client";
  readonly statusCode = 406;
  readonly $frameworkError = true;
}

export class UnauthenticatedException {
  readonly name = "UnauthenticatedException";
  readonly $fault = "client";
  readonly statusCode = 401;
  readonly $frameworkError = true;
}
