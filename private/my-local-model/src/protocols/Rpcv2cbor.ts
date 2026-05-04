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
import {
  _json,
  decorateServiceException as __decorateServiceException,
  take,
  withBaseException,
} from "@smithy/core/client";
import {
  type HttpRequest as __HttpRequest,
  type HttpResponse as __HttpResponse,
  collectBody,
} from "@smithy/core/protocols";
import {
  expectInt32 as __expectInt32,
  expectNonNull as __expectNonNull,
  expectString as __expectString,
  nv as __nv,
  parseEpochTimestamp as __parseEpochTimestamp,
} from "@smithy/core/serde";
import type {
  Endpoint as __Endpoint,
  EventStreamSerdeContext as __EventStreamSerdeContext,
  HeaderBag as __HeaderBag,
  Message as __Message,
  MessageHeaders as __MessageHeaders,
  ResponseMetadata as __ResponseMetadata,
  SerdeContext as __SerdeContext,
} from "@smithy/types";

import type {
  CamelCaseOperationCommandInput,
  CamelCaseOperationCommandOutput,
} from "../commands/CamelCaseOperationCommand";
import type { GetNumbersCommandInput, GetNumbersCommandOutput } from "../commands/GetNumbersCommand";
import type { HttpLabelCommandCommandInput, HttpLabelCommandCommandOutput } from "../commands/HttpLabelCommandCommand";
import type { TradeEventStreamCommandInput, TradeEventStreamCommandOutput } from "../commands/TradeEventStreamCommand";
import {
  CodedThrottlingError,
  HaltError,
  MainServiceLinkedError,
  MysteryThrottlingError,
  RetryableError,
  XYZServiceServiceException,
} from "../models/errors";
import {
  type Alpha,
  type CamelCaseOperationInput,
  type CamelCaseOperationOutput,
  type DifferentShapeName,
  type GetNumbersRequest,
  type GetNumbersResponse,
  type HttpLabelCommandInput,
  type Unit,
  TradeEvents,
} from "../models/models_0";
import { XYZServiceSyntheticServiceException as __BaseException } from "../models/XYZServiceSyntheticServiceException";

/**
 * serializeRpcv2cborHttpLabelCommandCommand
 */
export const se_HttpLabelCommandCommand = async (
  input: HttpLabelCommandCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const headers: __HeaderBag = SHARED_HEADERS;
  let body: any;
  body = cbor.serialize(_json(input));
  return buildHttpRpcRequest(context, headers, "/service/XYZService/operation/HttpLabelCommand", undefined, body);
};

/**
 * serializeRpcv2cborCamelCaseOperationCommand
 */
export const se_CamelCaseOperationCommand = async (
  input: CamelCaseOperationCommandInput,
  context: __SerdeContext
): Promise<__HttpRequest> => {
  const headers: __HeaderBag = SHARED_HEADERS;
  let body: any;
  body = cbor.serialize(_json(input));
  return buildHttpRpcRequest(context, headers, "/service/XYZService/operation/camelCaseOperation", undefined, body);
};

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
 * deserializeRpcv2cborHttpLabelCommandCommand
 */
export const de_HttpLabelCommandCommand = async (
  output: __HttpResponse,
  context: __SerdeContext
): Promise<HttpLabelCommandCommandOutput> => {
  cr(output);
  if (output.statusCode >= 300) {
    return de_CommandError(output, context);
  }

  const data: any = await parseBody(output.body, context)
  let contents: any = {};
  contents = _json(data);
  const response: HttpLabelCommandCommandOutput = {
    $metadata: deserializeMetadata(output), ...contents,
  };
  return response;

};

/**
 * deserializeRpcv2cborCamelCaseOperationCommand
 */
export const de_CamelCaseOperationCommand = async (
  output: __HttpResponse,
  context: __SerdeContext
): Promise<CamelCaseOperationCommandOutput> => {
  cr(output);
  if (output.statusCode >= 300) {
    return de_CommandError(output, context);
  }

  const data: any = await parseBody(output.body, context)
  let contents: any = {};
  contents = de_CamelCaseOperationOutput(data, context);
  const response: CamelCaseOperationCommandOutput = {
    $metadata: deserializeMetadata(output), ...contents,
  };
  return response;

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

  const data: any = await parseBody(output.body, context)
  let contents: any = {};
  contents = de_GetNumbersResponse(data, context);
  const response: GetNumbersCommandOutput = {
    $metadata: deserializeMetadata(output), ...contents,
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
    $metadata: deserializeMetadata(output), ...contents,
  };
  return response;

};

/**
 * deserialize_Rpcv2cborCommandError
 */
const de_CommandError = async (
  output: __HttpResponse,
  context: __SerdeContext,
): Promise<never> => {
  const parsedOutput: any = {
    ...output,
    body: await parseErrorBody(output.body, context)
  };
  const errorCode = loadSmithyRpcV2CborErrorCode(output, parsedOutput.body);
  switch (errorCode) {
    case "MainServiceLinkedError":
    case "org.xyz.v1#MainServiceLinkedError":
      throw await de_MainServiceLinkedErrorRes(parsedOutput, context);
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
        errorCode
      }) as never;
  }
}

/**
 * deserializeRpcv2cborCodedThrottlingErrorRes
 */
const de_CodedThrottlingErrorRes = async (
  parsedOutput: any,
  context: __SerdeContext
): Promise<CodedThrottlingError> => {
  const body = parsedOutput.body
  const deserialized: any = _json(body);
  const exception = new CodedThrottlingError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized
  });
  return __decorateServiceException(exception, body);
};

/**
 * deserializeRpcv2cborHaltErrorRes
 */
const de_HaltErrorRes = async (
  parsedOutput: any,
  context: __SerdeContext
): Promise<HaltError> => {
  const body = parsedOutput.body
  const deserialized: any = _json(body);
  const exception = new HaltError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized
  });
  return __decorateServiceException(exception, body);
};

/**
 * deserializeRpcv2cborMainServiceLinkedErrorRes
 */
const de_MainServiceLinkedErrorRes = async (
  parsedOutput: any,
  context: __SerdeContext
): Promise<MainServiceLinkedError> => {
  const body = parsedOutput.body
  const deserialized: any = _json(body);
  const exception = new MainServiceLinkedError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized
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
  const body = parsedOutput.body
  const deserialized: any = _json(body);
  const exception = new MysteryThrottlingError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized
  });
  return __decorateServiceException(exception, body);
};

/**
 * deserializeRpcv2cborRetryableErrorRes
 */
const de_RetryableErrorRes = async (
  parsedOutput: any,
  context: __SerdeContext
): Promise<RetryableError> => {
  const body = parsedOutput.body
  const deserialized: any = _json(body);
  const exception = new RetryableError({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized
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
  const body = parsedOutput.body
  const deserialized: any = _json(body);
  const exception = new XYZServiceServiceException({
    $metadata: deserializeMetadata(parsedOutput),
    ...deserialized
  });
  return __decorateServiceException(exception, body);
};

/**
 * serializeRpcv2cborTradeEvents
 */
const se_TradeEvents = (
  input: any,
  context: __SerdeContext & __EventStreamSerdeContext
): any => {
  const eventMarshallingVisitor = (event: any): __Message => TradeEvents.visit(event, {
    alpha: value => se_Alpha_event(value, context),
    beta: value => se_Unit_event(value, context),
    gamma: value => se_Unit_event(value, context),
    delta: value => se_DifferentShapeName_event(value, context),
    _: value => value as any
  });
  return context.eventStreamMarshaller.serialize(input, eventMarshallingVisitor);
}
const se_Alpha_event = (
  input: Alpha,
  context: __SerdeContext
): __Message => {
  const headers: __MessageHeaders = {
    ":event-type": { type: "string", value: "alpha" },
    ":message-type": { type: "string", value: "event" },
    ":content-type": { type: "string", value: "application/cbor" },
  }
  let body = new Uint8Array();
  body = se_Alpha(input, context);
  body = cbor.serialize(body);
  return { headers, body };
  }
  const se_DifferentShapeName_event = (
    input: DifferentShapeName,
    context: __SerdeContext
  ): __Message => {
    const headers: __MessageHeaders = {
      ":event-type": { type: "string", value: "delta" },
      ":message-type": { type: "string", value: "event" },
      ":content-type": { type: "string", value: "application/cbor" },
    }
    let body = new Uint8Array();
    body = _json(input);
    body = cbor.serialize(body);
    return { headers, body };
    }
    const se_Unit_event = (
      input: Unit,
      context: __SerdeContext
    ): __Message => {
      const headers: __MessageHeaders = {
        ":event-type": { type: "string", value: "beta" },
        ":message-type": { type: "string", value: "event" },
        ":content-type": { type: "string", value: "application/cbor" },
      }
      let body = new Uint8Array();
      body = _json(input);
      body = cbor.serialize(body);
      return { headers, body };
      }
      /**
       * deserializeRpcv2cborTradeEvents
       */
      const de_TradeEvents = (
        output: any,
        context: __SerdeContext & __EventStreamSerdeContext
      ): AsyncIterable<TradeEvents> => {
        return context.eventStreamMarshaller.deserialize(
          output,
          async event => {
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
            if (event["delta"] != null) {
              return {
                delta: await de_DifferentShapeName_event(event["delta"], context),
              };
            }
            return {$unknown: event as any};
          }
        );
      }
      const de_Alpha_event = async (
        output: any,
        context: __SerdeContext
      ): Promise<Alpha> => {
        const contents: Alpha = {} as any;
        const data: any = await parseBody(output.body, context);
        Object.assign(contents, de_Alpha(data, context));
        return contents;
      }
      const de_DifferentShapeName_event = async (
        output: any,
        context: __SerdeContext
      ): Promise<DifferentShapeName> => {
        const contents: DifferentShapeName = {} as any;
        const data: any = await parseBody(output.body, context);
        Object.assign(contents, _json(data));
        return contents;
      }
      const de_Unit_event = async (
        output: any,
        context: __SerdeContext
      ): Promise<Unit> => {
        const contents: Unit = {} as any;
        const data: any = await parseBody(output.body, context);
        Object.assign(contents, _json(data));
        return contents;
      }
      // se_HttpLabelCommandInput omitted.

      /**
       * serializeRpcv2cborAlpha
       */
      const se_Alpha = (
        input: Alpha,
        context: __SerdeContext
      ): any => {
        return take(input, {
          'id': [],
          'timestamp': __dateToTag,
        });
      }

      // se_CamelCaseOperationInput omitted.

      // se_DifferentShapeName omitted.

      /**
       * serializeRpcv2cborGetNumbersRequest
       */
      const se_GetNumbersRequest = (
        input: GetNumbersRequest,
        context: __SerdeContext
      ): any => {
        return take(input, {
          'bigDecimal': __nv,
          'bigInteger': [],
          'customHeaderInput': [],
          'fieldWithMessage': [],
          'fieldWithoutMessage': [],
          'maxResults': [],
          'numbers': _json,
          'sparseNumbers': _ => se_SparseIntegerMap(_, context),
          'startToken': [],
        });
      }

      // se_IntegerMap omitted.

      /**
       * serializeRpcv2cborSparseIntegerMap
       */
      const se_SparseIntegerMap = (
        input: Record<string, number | null>,
        context: __SerdeContext
      ): any => {
        return Object.entries(input).reduce((acc: Record<string, any>, [key, value]: [string, any]) => {
          if (value !== null) {
              acc[key] = value;
          }

          else {
              acc[key] = null as any;
          }

          return acc;
        }, {});
      }

      // se_Unit omitted.

      // de_HttpLabelCommandOutput omitted.

      /**
       * deserializeRpcv2cborAlpha
       */
      const de_Alpha = (
        output: any,
        context: __SerdeContext
      ): Alpha => {
        return take(output, {
          'id': __expectString,
          'timestamp': (_: any) => __expectNonNull(__parseEpochTimestamp(_)),
        }) as any;
      }

      /**
       * deserializeRpcv2cborBlobs
       */
      const de_Blobs = (
        output: any,
        context: __SerdeContext
      ): Uint8Array[] => {
        const collection = (output || []).filter((e: any) => e != null)
        return collection;
      }

      /**
       * deserializeRpcv2cborCamelCaseOperationOutput
       */
      const de_CamelCaseOperationOutput = (
        output: any,
        context: __SerdeContext
      ): CamelCaseOperationOutput => {
        return take(output, {
          'results': (_: any) => de_Blobs(_, context),
          'token': __expectString,
        }) as any;
      }

      // de_CodedThrottlingError omitted.

      // de_DifferentShapeName omitted.

      /**
       * deserializeRpcv2cborGetNumbersResponse
       */
      const de_GetNumbersResponse = (
        output: any,
        context: __SerdeContext
      ): GetNumbersResponse => {
        return take(output, {
          'bigDecimal': [],
          'bigInteger': [],
          'deprecatedNumbers': _json,
          'deprecatedNumbersWithoutChronology': _json,
          'deprecatedNumbersWithoutExplanation': _json,
          'inexplicablyDeprecatedNumbers': _json,
          'nextToken': __expectString,
          'numbers': _json,
          'sparseNumbers': (_: any) => de_SparseIntegerList(_, context),
        }) as any;
      }

      // de_HaltError omitted.

      // de_IntegerList omitted.

      // de_MainServiceLinkedError omitted.

      // de_MysteryThrottlingError omitted.

      // de_RetryableError omitted.

      /**
       * deserializeRpcv2cborSparseIntegerList
       */
      const de_SparseIntegerList = (
        output: any,
        context: __SerdeContext
      ): (number | null)[] => {
        const collection = (output || []).map((entry: any) => {
          if (entry === null) {
            return null as any;
          }
          return __expectInt32(entry) as any;
        });
        return collection;
      }

      // de_XYZServiceServiceException omitted.

      // de_Unit omitted.

      const deserializeMetadata = (output: __HttpResponse): __ResponseMetadata => ({
        httpStatusCode: output.statusCode,
        requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
        extendedRequestId: output.headers["x-amz-id-2"],
        cfId: output.headers["x-amz-cf-id"],
      });

      const throwDefaultError = withBaseException(__BaseException);
      const SHARED_HEADERS: __HeaderBag = {
        'content-type': "application/cbor",
        "smithy-protocol": "rpc-v2-cbor",
        "accept": "application/cbor",

      };
