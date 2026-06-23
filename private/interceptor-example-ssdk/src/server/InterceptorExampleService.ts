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
  ServerSerdeContext as __ServerSerdeContext,
  ServiceException as __ServiceException,
  ServiceHandler as __ServiceHandler,
  SmithyFrameworkException as __SmithyFrameworkException,
  UnknownOperationException as __UnknownOperationException,
  ValidationCustomizer as __ValidationCustomizer,
  ValidationFailure as __ValidationFailure,
} from "@aws-smithy/server-common";
import { HttpRequest as __HttpRequest, HttpResponse as __HttpResponse } from "@smithy/core/protocols";
import { fromBase64, fromUtf8, toBase64, toUtf8 } from "@smithy/core/serde";
import { NodeHttpHandler, streamCollector } from "@smithy/node-http-handler";

import { serializeFrameworkException } from "../protocols/Fakeprotocol";
import { GetItem, GetItemSerializer, GetItemServerInput } from "./operations/GetItem";
import { Ping, PingSerializer, PingServerInput } from "./operations/Ping";

export type InterceptorExampleServiceOperations = "GetItem" | "Ping";
export interface InterceptorExampleService<Context> {
  GetItem: GetItem<Context>
  Ping: Ping<Context>
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
export class InterceptorExampleServiceHandler<Context> implements __ServiceHandler<Context> {
  private readonly service: InterceptorExampleService<Context>;
  private readonly mux: __Mux<"InterceptorExample", InterceptorExampleServiceOperations>;
  private readonly serializerFactory: <T extends InterceptorExampleServiceOperations>(operation: T) => __OperationSerializer<InterceptorExampleService<Context>, T, __ServiceException>;
  private readonly serializeFrameworkException: (e: __SmithyFrameworkException, ctx: __ServerSerdeContext) => Promise<__HttpResponse>;
  private readonly validationCustomizer: __ValidationCustomizer<InterceptorExampleServiceOperations>;
  /**
   * Construct a InterceptorExampleService handler.
   * @param service The {@link InterceptorExampleService} implementation that supplies the business logic for InterceptorExampleService
   * @param mux The {@link __Mux} that determines which service and operation are being invoked by a given {@link __HttpRequest}
   * @param serializerFactory A factory for an {@link __OperationSerializer} for each operation in InterceptorExampleService that
   *                          handles deserialization of requests and serialization of responses
   * @param serializeFrameworkException A function that can serialize {@link __SmithyFrameworkException}s
   * @param validationCustomizer A {@link __ValidationCustomizer} for turning validation failures into {@link __SmithyFrameworkException}s
   */
  constructor(
    service: InterceptorExampleService<Context>,
    mux: __Mux<"InterceptorExample", InterceptorExampleServiceOperations>,
    serializerFactory:<T extends InterceptorExampleServiceOperations>(op: T) => __OperationSerializer<InterceptorExampleService<Context>, T, __ServiceException>,
    serializeFrameworkException: (e: __SmithyFrameworkException, ctx: __ServerSerdeContext) => Promise<__HttpResponse>,
    validationCustomizer: __ValidationCustomizer<InterceptorExampleServiceOperations>
  ) {
    this.service = service;
    this.mux = mux;
    this.serializerFactory = serializerFactory;
    this.serializeFrameworkException = serializeFrameworkException;
    this.validationCustomizer = validationCustomizer;
  }
  async handle(request: __HttpRequest, context: Context): Promise<__HttpResponse> {
    const target = this.mux.match(request);
    if (target === undefined) {
      return this.serializeFrameworkException(new __UnknownOperationException(), serdeContextBase);
    }
    switch (target.operation) {
      case "GetItem" : {
        return handle(request, context, "GetItem", this.serializerFactory("GetItem"), this.service.GetItem, this.serializeFrameworkException, GetItemServerInput.validate, this.validationCustomizer);
      }
      case "Ping" : {
        return handle(request, context, "Ping", this.serializerFactory("Ping"), this.service.Ping, this.serializeFrameworkException, PingServerInput.validate, this.validationCustomizer);
      }
    }
  }
}

export const getInterceptorExampleServiceHandler = <Context>(service: InterceptorExampleService<Context>, customizer: __ValidationCustomizer<InterceptorExampleServiceOperations>): __ServiceHandler<Context, __HttpRequest, __HttpResponse> => {
  const mux = new httpbinding.HttpBindingMux<"InterceptorExample", keyof InterceptorExampleService<Context>>([
    new httpbinding.UriSpec<"InterceptorExample", "GetItem">(
      'GET',
      [
        { type: 'path_literal', value: "item" },
        { type: 'path' },
      ],
      [
      ],
      { service: "InterceptorExample", operation: "GetItem" }),
    new httpbinding.UriSpec<"InterceptorExample", "Ping">(
      'POST',
      [
        { type: 'path_literal', value: "ping" },
      ],
      [
      ],
      { service: "InterceptorExample", operation: "Ping" }),
  ]);
  const serFn: (op: InterceptorExampleServiceOperations) => __OperationSerializer<InterceptorExampleService<Context>, InterceptorExampleServiceOperations, __ServiceException> = (op) => {
    switch (op) {
      case "GetItem": return new GetItemSerializer();
      case "Ping": return new PingSerializer();
    }
  };
  return new InterceptorExampleServiceHandler(service, mux, serFn, serializeFrameworkException, customizer);
}
