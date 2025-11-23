// smithy-typescript generated code
import {
  buildHttpRpcRequest,
  cbor,
  checkCborResponse as cr,
  dateToTag as __dateToTag,
  loadSmithyRpcV2CborErrorCode,
  parseCborBody as parseBody,
  parseCborErrorBody as parseErrorBody,
} from "@smithy/core/cbor";
import { nv as __nv } from "@smithy/core/serde";
import type { HttpRequest as __HttpRequest, HttpResponse as __HttpResponse } from "@smithy/protocol-http";
import {
  _json,
  collectBody,
  decorateServiceException as __decorateServiceException,
  expectNonNull as __expectNonNull,
  expectString as __expectString,
  parseEpochTimestamp as __parseEpochTimestamp,
  take,
  withBaseException,
} from "@smithy/smithy-client";
import type {
  Endpoint as __Endpoint,
  EventStreamSerdeContext as __EventStreamSerdeContext,
  HeaderBag as __HeaderBag,
  MessageHeaders as __MessageHeaders,
  Message as __Message,
  ResponseMetadata as __ResponseMetadata,
  SerdeContext as __SerdeContext,
} from "@smithy/types";

import { GetNumbersCommandInput, GetNumbersCommandOutput } from "../commands/GetNumbersCommand";
import { TradeEventStreamCommandInput, TradeEventStreamCommandOutput } from "../commands/TradeEventStreamCommand";
import {
  CodedThrottlingError,
  HaltError,
  MysteryThrottlingError,
  RetryableError,
  XYZServiceServiceException,
} from "../models/errors";
import { Alpha, GetNumbersRequest, GetNumbersResponse, TradeEvents, Unit } from "../models/models_0";
import { XYZServiceSyntheticServiceException as __BaseException } from "../models/XYZServiceSyntheticServiceException";

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
 * serializeRpcv2cborTradeEventStreamCommand
 */
export const se_TradeEventStreamCommand = async (
  input: TradeEventStreamCommandInput,
  context: __SerdeContext & __EventStreamSerdeContext
): Promise<__HttpRequest> => {
  const headers: __HeaderBag = { ...SHARED_HEADERS };
  headers.accept = "application/vnd.amazon.eventstream";

  headers["content-type"] = "application/vnd.amazon.eventstream";

  let body: any;
  body = se_TradeEvents(input.eventStream, context);
  return buildHttpRpcRequest(context, headers, "/service/XYZService/operation/TradeEventStream", undefined, body);
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
 * deserializeRpcv2cborTradeEventStreamCommand
 */
export const de_TradeEventStreamCommand = async (
  output: __HttpResponse,
  context: __SerdeContext & __EventStreamSerdeContext
): Promise<TradeEventStreamCommandOutput> => {
  cr(output);
  if (output.statusCode >= 300) {
    return de_CommandError(output, context);
  }

  const contents = { eventStream: de_TradeEvents(output.body, context) };
  const response: TradeEventStreamCommandOutput = {
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
    case "XYZServiceServiceException":
    case "org.xyz.v1#XYZServiceServiceException":
      throw await de_XYZServiceServiceExceptionRes(parsedOutput, context);
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
 * deserializeRpcv2cborXYZServiceServiceExceptionRes
 */
const de_XYZServiceServiceExceptionRes = async (
  parsedOutput: any,
  context: __SerdeContext
): Promise<XYZServiceServiceException> => {
  const body = parsedOutput.body;
  const deserialized: any = _json(body);
  const exception = new XYZServiceServiceException({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized,
  });
  return __decorateServiceException(exception, body);
};

/**
 * serializeRpcv2cborTradeEvents
 */
const se_TradeEvents = (input: any, context: __SerdeContext & __EventStreamSerdeContext): any => {
  const eventMarshallingVisitor = (event: any): __Message =>
    TradeEvents.visit(event, {
      alpha: (value) => se_Alpha_event(value, context),
      beta: (value) => se_Unit_event(value, context),
      gamma: (value) => se_Unit_event(value, context),
      _: (value) => value as any,
    });
  return context.eventStreamMarshaller.serialize(input, eventMarshallingVisitor);
};
const se_Alpha_event = (input: Alpha, context: __SerdeContext): __Message => {
  const headers: __MessageHeaders = {
    ":event-type": { type: "string", value: "alpha" },
    ":message-type": { type: "string", value: "event" },
    ":content-type": { type: "string", value: "application/cbor" },
  };
  let body = new Uint8Array();
  body = se_Alpha(input, context);
  body = cbor.serialize(body);
  return { headers, body };
};
const se_Unit_event = (input: Unit, context: __SerdeContext): __Message => {
  const headers: __MessageHeaders = {
    ":event-type": { type: "string", value: "beta" },
    ":message-type": { type: "string", value: "event" },
    ":content-type": { type: "string", value: "application/cbor" },
  };
  let body = new Uint8Array();
  body = _json(input);
  body = cbor.serialize(body);
  return { headers, body };
};
/**
 * deserializeRpcv2cborTradeEvents
 */
const de_TradeEvents = (
  output: any,
  context: __SerdeContext & __EventStreamSerdeContext
): AsyncIterable<TradeEvents> => {
  return context.eventStreamMarshaller.deserialize(output, async (event) => {
    if (event["alpha"] != null) {
      return {
        alpha: await de_Alpha_event(event["alpha"], context),
      };
    }
    if (event["beta"] != null) {
      return {
        beta: await de_Unit_event(event["beta"], context),
      };
    }
    if (event["gamma"] != null) {
      return {
        gamma: await de_Unit_event(event["gamma"], context),
      };
    }
    return { $unknown: event as any };
  });
};
const de_Alpha_event = async (output: any, context: __SerdeContext): Promise<Alpha> => {
  const contents: Alpha = {} as any;
  const data: any = await parseBody(output.body, context);
  Object.assign(contents, de_Alpha(data, context));
  return contents;
};
const de_Unit_event = async (output: any, context: __SerdeContext): Promise<Unit> => {
  const contents: Unit = {} as any;
  const data: any = await parseBody(output.body, context);
  Object.assign(contents, _json(data));
  return contents;
};
/**
 * serializeRpcv2cborAlpha
 */
const se_Alpha = (input: Alpha, context: __SerdeContext): any => {
  return take(input, {
    id: [],
    timestamp: __dateToTag,
  });
};

/**
 * serializeRpcv2cborGetNumbersRequest
 */
const se_GetNumbersRequest = (input: GetNumbersRequest, context: __SerdeContext): any => {
  return take(input, {
    bigDecimal: __nv,
    bigInteger: [],
    fieldWithMessage: [],
    fieldWithoutMessage: [],
  });
};

// se_Unit omitted.

/**
 * deserializeRpcv2cborAlpha
 */
const de_Alpha = (output: any, context: __SerdeContext): Alpha => {
  return take(output, {
    id: __expectString,
    timestamp: (_: any) => __expectNonNull(__parseEpochTimestamp(_)),
  }) as any;
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

// de_XYZServiceServiceException omitted.

// de_Unit omitted.

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
