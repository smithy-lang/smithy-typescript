// smithy-typescript generated code
import {
  httpbinding,
  InternalFailureException as __InternalFailureException,
  isFrameworkException as __isFrameworkException,
  Mux as __Mux,
  Operation as __Operation,
  OperationInput as __OperationInput,
  OperationOutput as __OperationOutput,
  OperationSerializer as __OperationSerializer,
  SerializationException as __SerializationException,
  ServerSerdeContext,
  ServerSerdeContext as __ServerSerdeContext,
  ServiceException as __ServiceException,
  ServiceHandler as __ServiceHandler,
  SmithyFrameworkException as __SmithyFrameworkException,
  ValidationCustomizer as __ValidationCustomizer,
  ValidationFailure as __ValidationFailure,
} from "@aws-smithy/server-common";
import { HttpRequest as __HttpRequest, HttpResponse as __HttpResponse } from "@smithy/core/protocols";
import { fromBase64, fromUtf8, toBase64, toUtf8 } from "@smithy/core/serde";
import { NodeHttpHandler, streamCollector } from "@smithy/node-http-handler";

import { GetItemInput, GetItemOutput } from "../../models/models_0";
import {
  deserializeGetItemRequest,
  serializeFrameworkException,
  serializeGetItemResponse,
} from "../../protocols/Fakeprotocol";
import { InterceptorExampleService } from "../InterceptorExampleService";

export type GetItem<Context> = __Operation<GetItemServerInput, GetItemServerOutput, Context>

export interface GetItemServerInput extends GetItemInput {}
export namespace GetItemServerInput {
  /**
   * @internal
   */
  export const validate: (obj: Parameters<typeof GetItemInput.validate>[0]) => __ValidationFailure[] = GetItemInput.validate;
}
export interface GetItemServerOutput extends GetItemOutput {}

export type GetItemErrors = never;

export class GetItemSerializer implements __OperationSerializer<InterceptorExampleService<any>, "GetItem", GetItemErrors> {
  serialize = serializeGetItemResponse;
  deserialize = deserializeGetItemRequest;

  isOperationError(error: any): error is GetItemErrors {
    return false;
  };

  serializeError(error: GetItemErrors, ctx: ServerSerdeContext): Promise<__HttpResponse> {
    throw error;
  }

}

export const getGetItemHandler = <Context>(operation: __Operation<GetItemServerInput, GetItemServerOutput, Context>, customizer: __ValidationCustomizer<"GetItem">): __ServiceHandler<Context, __HttpRequest, __HttpResponse> => {
  const mux = new httpbinding.HttpBindingMux<"InterceptorExample", "GetItem">([
    new httpbinding.UriSpec<"InterceptorExample", "GetItem">(
      'GET',
      [
        { type: 'path_literal', value: "item" },
        { type: 'path' },
      ],
      [
      ],
      { service: "InterceptorExample", operation: "GetItem" }),
  ]);
  return new GetItemHandler(operation, mux, new GetItemSerializer(), serializeFrameworkException, customizer);
}

const serdeContextBase = {
  base64Encoder: toBase64,
  base64Decoder: fromBase64,
  utf8Encoder: toUtf8,
  utf8Decoder: fromUtf8,
  streamCollector: streamCollector,
  requestHandler: new NodeHttpHandler(),
  disableHostPrefix: true
};
async function handle<S, O extends keyof S & string, Context>(
  request: __HttpRequest,
  context: Context,
  operationName: O,
  serializer: __OperationSerializer<S, O, __ServiceException>,
  operation: __Operation<__OperationInput<S[O]>, __OperationOutput<S[O]>, Context>,
  serializeFrameworkException: (e: __SmithyFrameworkException, ctx: __ServerSerdeContext) => Promise<__HttpResponse>,
  validationFn: (input: __OperationInput<S[O]>) => __ValidationFailure[],
  validationCustomizer: __ValidationCustomizer<O>
): Promise<__HttpResponse> {
  let input;
  try {
    input = await serializer.deserialize(request, {
      endpoint: () => Promise.resolve(request), ...serdeContextBase
    });
  } catch (error: unknown) {
    if (__isFrameworkException(error)) {
      return serializeFrameworkException(error, serdeContextBase);
    };
    return serializeFrameworkException(new __SerializationException(), serdeContextBase);
  }
  try {
    let validationFailures = validationFn(input);
    if (validationFailures && validationFailures.length > 0) {
      let validationException = validationCustomizer({ operation: operationName }, validationFailures);
      if (validationException) {
        return serializer.serializeError(validationException, serdeContextBase);
      }
    }
    let output = await operation(input, context);
    return serializer.serialize(output, serdeContextBase);
  } catch(error: unknown) {
    if (serializer.isOperationError(error)) {
      return serializer.serializeError(error, serdeContextBase);
    }
    console.log('Received an unexpected error', error);
    return serializeFrameworkException(new __InternalFailureException(), serdeContextBase);
  }
}
export class GetItemHandler<Context> implements __ServiceHandler<Context> {
  private readonly operation: __Operation<GetItemServerInput, GetItemServerOutput, Context>;
  private readonly mux: __Mux<"InterceptorExample", "GetItem">;
  private readonly serializer: __OperationSerializer<InterceptorExampleService<Context>, "GetItem", GetItemErrors>;
  private readonly serializeFrameworkException: (e: __SmithyFrameworkException, ctx: __ServerSerdeContext) => Promise<__HttpResponse>;
  private readonly validationCustomizer: __ValidationCustomizer<"GetItem">;
  /**
   * Construct a GetItem handler.
   * @param operation The {@link __Operation} implementation that supplies the business logic for GetItem
   * @param mux The {@link __Mux} that verifies which service and operation are being invoked by a given {@link __HttpRequest}
   * @param serializer An {@link __OperationSerializer} for GetItem that
   *                   handles deserialization of requests and serialization of responses
   * @param serializeFrameworkException A function that can serialize {@link __SmithyFrameworkException}s
   * @param validationCustomizer A {@link __ValidationCustomizer} for turning validation failures into {@link __SmithyFrameworkException}s
   */
  constructor(
    operation: __Operation<GetItemServerInput, GetItemServerOutput, Context>,
    mux: __Mux<"InterceptorExample", "GetItem">,
    serializer: __OperationSerializer<InterceptorExampleService<Context>, "GetItem", GetItemErrors>,
    serializeFrameworkException: (e: __SmithyFrameworkException, ctx: __ServerSerdeContext) => Promise<__HttpResponse>,
    validationCustomizer: __ValidationCustomizer<"GetItem">
  ) {
    this.operation = operation;
    this.mux = mux;
    this.serializer = serializer;
    this.serializeFrameworkException = serializeFrameworkException;
    this.validationCustomizer = validationCustomizer;
  }
  async handle(request: __HttpRequest, context: Context): Promise<__HttpResponse> {
    const target = this.mux.match(request);
    if (target === undefined) {
      console.log('Received a request that did not match example.interceptors#InterceptorExample.GetItem. This indicates a misconfiguration.');
      return this.serializeFrameworkException(new __InternalFailureException(), serdeContextBase);
    }
    return handle(request, context, "GetItem", this.serializer, this.operation, this.serializeFrameworkException, GetItemServerInput.validate, this.validationCustomizer);
  }
}
