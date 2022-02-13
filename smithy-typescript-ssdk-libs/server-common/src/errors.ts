/*
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *   http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

export class SmithyException extends Error {
  /**
   * Whether the client or server are at fault.
   */
  readonly $fault: "client" | "server";

  constructor(options: { name: string; $fault: "client" | "server"; message?: string }) {
    super(options.message);
    Object.setPrototypeOf(this, SmithyException.prototype);
    this.name = options.name;
    this.$fault = options.$fault;
  }
}

export type SmithyFrameworkException =
  | InternalFailureException
  | UnknownOperationException
  | SerializationException
  | UnsupportedMediaTypeException
  | NotAcceptableException;

export const isFrameworkException = (error: any): error is SmithyFrameworkException => {
  if (!error.hasOwnProperty("$frameworkError")) {
    return false;
  }
  return error.$frameworkError;
};

export class InternalFailureException extends SmithyException {
  readonly name = "InternalFailure";
  readonly $fault = "server";
  readonly statusCode = 500;
  readonly $frameworkError = true;
  constructor() {
    super({ name: "InternalFailure", $fault: "server" });
    Object.setPrototypeOf(this, InternalFailureException.prototype);
  }
}

export class UnknownOperationException extends SmithyException {
  readonly name = "UnknownOperationException";
  readonly $fault = "client";
  readonly statusCode = 404;
  readonly $frameworkError = true;
  constructor() {
    super({ name: "UnknownOperationException", $fault: "client" });
    Object.setPrototypeOf(this, UnknownOperationException.prototype);
  }
}

export class SerializationException extends SmithyException {
  readonly name = "SerializationException";
  readonly $fault = "client";
  readonly statusCode = 400;
  readonly $frameworkError = true;
  constructor() {
    super({ name: "SerializationException", $fault: "client" });
    Object.setPrototypeOf(this, SerializationException.prototype);
  }
}

export class UnsupportedMediaTypeException extends SmithyException {
  readonly name = "UnsupportedMediaTypeException";
  readonly $fault = "client";
  readonly statusCode = 415;
  readonly $frameworkError = true;
  constructor() {
    super({ name: "UnsupportedMediaTypeException", $fault: "client" });
    Object.setPrototypeOf(this, UnsupportedMediaTypeException.prototype);
  }
}

export class NotAcceptableException extends SmithyException {
  readonly name = "NotAcceptableException";
  readonly $fault = "client";
  readonly statusCode = 406;
  readonly $frameworkError = true;
  constructor() {
    super({ name: "NotAcceptableException", $fault: "client" });
    Object.setPrototypeOf(this, NotAcceptableException.prototype);
  }
}
