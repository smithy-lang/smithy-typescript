// smithy-typescript generated code
import { GetNumbersCommandInput, GetNumbersCommandOutput } from "../commands/GetNumbersCommand";
import { XYZServiceServiceException as __BaseException } from "../models/XYZServiceServiceException";
import {
  CodedThrottlingError,
  GetNumbersRequest,
  GetNumbersResponse,
  HaltError,
  MysteryThrottlingError,
  RetryableError,
} from "../models/models_0";
import {
  buildHttpRpcRequest,
  cbor,
  checkCborResponse as cr,
  loadSmithyRpcV2CborErrorCode,
  parseCborBody as parseBody,
  parseCborErrorBody as parseErrorBody,
} from "@smithy/core/cbor";
import { nv as __nv } from "@smithy/core/serde";
import { HttpRequest as __HttpRequest, HttpResponse as __HttpResponse } from "@smithy/protocol-http";
import {
  decorateServiceException as __decorateServiceException,
  _json,
  collectBody,
  take,
  withBaseException,
} from "@smithy/smithy-client";
import {
  Endpoint as __Endpoint,
  HeaderBag as __HeaderBag,
  ResponseMetadata as __ResponseMetadata,
  SerdeContext as __SerdeContext,
} from "@smithy/types";

/**
 * serializeRpcv2cborGetNumbersCommand
 */
export const se_GetNumbersCommand = async (
  input: GetNumbersCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const headers: __HeaderBag = SHARED_HEADERS;
  let body: any;
  body = cbor.serialize(se_GetNumbersRequest(input, context));
  return buildHttpRpcRequest(context, headers, "/service/XYZService/operation/GetNumbers", undefined, body);
};

/**
 * deserializeRpcv2cborGetNumbersCommand
 */
export const de_GetNumbersCommand = async (
  output: __HttpResponse,
  context: __SerdeContext
): Promise<GetNumbersCommandOutput> => {
  cr(output);
  if (output.statusCode >= 300) {
    return de_CommandError(output, context);
  }

  const data: any = await parseBody(output.body, context);
  let contents: any = {};
  contents = de_GetNumbersResponse(data, context);
  const response: GetNumbersCommandOutput = {
    $metadata: deserializeMetadata(output),
    ...contents,
  };
  return response;
};

/**
 * deserialize_Rpcv2cborCommandError
 */
const de_CommandError = async (output: __HttpResponse, context: __SerdeContext): Promise<never> => {
  const parsedOutput: any = {
    ...output,
    body: await parseErrorBody(output.body, context),
  };
  const errorCode = loadSmithyRpcV2CborErrorCode(output, parsedOutput.body);
  switch (errorCode) {
    case "CodedThrottlingError":
    case "org.xyz.v1#CodedThrottlingError":
      throw await de_CodedThrottlingErrorRes(parsedOutput, context);
    case "HaltError":
    case "org.xyz.v1#HaltError":
      throw await de_HaltErrorRes(parsedOutput, context);
    case "MysteryThrottlingError":
    case "org.xyz.v1#MysteryThrottlingError":
      throw await de_MysteryThrottlingErrorRes(parsedOutput, context);
    case "RetryableError":
    case "org.xyz.v1#RetryableError":
      throw await de_RetryableErrorRes(parsedOutput, context);
    default:
      const parsedBody = parsedOutput.body;
      return throwDefaultError({
        output,
        parsedBody,
        errorCode,
      }) as never;
  }
};

/**
 * deserializeRpcv2cborCodedThrottlingErrorRes
 */
const de_CodedThrottlingErrorRes = async (
  parsedOutput: any,
  context: __SerdeContext
): Promise<CodedThrottlingError> => {
  const body = parsedOutput.body;
  const deserialized: any = _json(body);
  const exception = new CodedThrottlingError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized,
  });
  return __decorateServiceException(exception, body);
};

/**
 * deserializeRpcv2cborHaltErrorRes
 */
const de_HaltErrorRes = async (parsedOutput: any, context: __SerdeContext): Promise<HaltError> => {
  const body = parsedOutput.body;
  const deserialized: any = _json(body);
  const exception = new HaltError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized,
  });
  return __decorateServiceException(exception, body);
};

/**
 * deserializeRpcv2cborMysteryThrottlingErrorRes
 */
const de_MysteryThrottlingErrorRes = async (
  parsedOutput: any,
  context: __SerdeContext
): Promise<MysteryThrottlingError> => {
  const body = parsedOutput.body;
  const deserialized: any = _json(body);
  const exception = new MysteryThrottlingError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized,
  });
  return __decorateServiceException(exception, body);
};

/**
 * deserializeRpcv2cborRetryableErrorRes
 */
const de_RetryableErrorRes = async (parsedOutput: any, context: __SerdeContext): Promise<RetryableError> => {
  const body = parsedOutput.body;
  const deserialized: any = _json(body);
  const exception = new RetryableError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized,
  });
  return __decorateServiceException(exception, body);
};

/**
 * serializeRpcv2cborGetNumbersRequest
 */
const se_GetNumbersRequest = (input: GetNumbersRequest, context: __SerdeContext): any => {
  return take(input, {
    bigDecimal: __nv,
    bigInteger: [],
  });
};

// de_CodedThrottlingError omitted.

/**
 * deserializeRpcv2cborGetNumbersResponse
 */
const de_GetNumbersResponse = (output: any, context: __SerdeContext): GetNumbersResponse => {
  return take(output, {
    bigDecimal: [],
    bigInteger: [],
  }) as any;
};

// de_HaltError omitted.

// de_MysteryThrottlingError omitted.

// de_RetryableError omitted.

const deserializeMetadata = (output: __HttpResponse): __ResponseMetadata => ({
  httpStatusCode: output.statusCode,
  requestId:
    output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
  extendedRequestId: output.headers["x-amz-id-2"],
  cfId: output.headers["x-amz-cf-id"],
});

const throwDefaultError = withBaseException(__BaseException);
const SHARED_HEADERS: __HeaderBag = {
  "content-type": "application/cbor",
  "smithy-protocol": "rpc-v2-cbor",
  accept: "application/cbor",
};
