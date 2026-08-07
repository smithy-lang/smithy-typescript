/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export class ServiceException extends Error {
  /**
   * Whether the client or server are at fault.
   */
  readonly $fault: "client" | "server";

  constructor(options: { name: string; $fault: "client" | "server"; message?: string }) {
    super(options.message);
    Object.setPrototypeOf(this, ServiceException.prototype);
    this.name = options.name;
    this.$fault = options.$fault;
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
