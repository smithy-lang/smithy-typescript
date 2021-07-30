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

import { SmithyException } from "@aws-sdk/smithy-client";

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

export class InternalFailureException implements SmithyException {
  readonly name = "InternalFailure";
  readonly $fault = "server";
  readonly statusCode = 500;
  readonly $frameworkError = true;
}

export class UnknownOperationException implements SmithyException {
  readonly name = "UnknownOperationException";
  readonly $fault = "client";
  readonly statusCode = 404;
  readonly $frameworkError = true;
}

export class SerializationException implements SmithyException {
  readonly name = "SerializationException";
  readonly $fault = "client";
  readonly statusCode = 400;
  readonly $frameworkError = true;
}

export class UnsupportedMediaTypeException implements SmithyException {
  readonly name = "UnsupportedMediaTypeException";
  readonly $fault = "client";
  readonly statusCode = 415;
  readonly $frameworkError = true;
}

export class NotAcceptableException implements SmithyException {
  readonly name = "NotAcceptableException";
  readonly $fault = "client";
  readonly statusCode = 406;
  readonly $frameworkError = true;
}
