import { RpcProtocol } from "../RpcProtocol";
import { NormalizedSchema, TypeRegistry, deref } from "@smithy/core/schema";
import { getSmithyContext } from "@smithy/core/transport";
import type {
  EndpointBearer,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  ResponseMetadata,
  SerdeFunctions,
  StaticErrorSchema,
  TimestampEpochSecondsSchema,
} from "@smithy/types";

import { JsonCodec2 } from "./codec-v2/JsonCodec2";
import { JsonShapeDeserializer2 } from "./codec-v2/JsonShapeDeserializer2";
import { loadJsonRpcErrorCode } from "./parseJsonBody";

/**
 * Client protocol for Smithy RPCv2 JSON.
 *
 * @public
 */
export class SmithyRpcV2JsonProtocol extends RpcProtocol {
  /**
   * @override
   */
  declare protected compositeErrorRegistry: TypeRegistry;
  private codec = new JsonCodec2({
    timestampFormat: {
      // RPCv2 JSON always serializes timestamps as epoch-seconds and MUST NOT
      // respect the model's timestampFormat trait.
      useTrait: false,
      default: 7 as const satisfies TimestampEpochSecondsSchema,
    },
    jsonName: false,
    // RPCv2 JSON serializes bigInteger/bigDecimal as JSON strings (SEP).
    bigNumberAsString: true,
  });
  protected serializer = this.codec.createSerializer();
  protected deserializer = this.codec.createDeserializer();

  public constructor({
    defaultNamespace,
    errorTypeRegistries,
  }: {
    defaultNamespace: string;
    errorTypeRegistries?: TypeRegistry[];
  }) {
    super({ defaultNamespace, errorTypeRegistries });
  }

  public getShapeId(): string {
    return "smithy.protocols#rpcv2Json";
  }

  public getPayloadCodec(): JsonCodec2 {
    return this.codec;
  }

  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest> {
    const request = await super.serializeRequest(operationSchema, input, context);
    Object.assign(request.headers, {
      "content-type": this.getDefaultContentType(),
      "smithy-protocol": "rpc-v2-json",
      accept: this.getDefaultContentType(),
    });
    if (deref(operationSchema.input) === "unit") {
      delete request.body;
      delete request.headers["content-type"];
    } else if (!request.body) {
      request.body = "{}";
    }
    const { service, operation } = getSmithyContext(context) as {
      service: string;
      operation: string;
    };
    const path = `/service/${service}/operation/${operation}`;
    if (request.path.endsWith("/")) {
      request.path += path.slice(1);
    } else {
      request.path += path;
    }
    return request;
  }

  public async deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse
  ): Promise<Output> {
    return super.deserializeResponse<Output>(operationSchema, context, response);
  }

  protected async handleError(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    dataObject: any,
    metadata: ResponseMetadata
  ): Promise<never> {
    const errorName = loadJsonRpcErrorCode(response, dataObject) ?? "Unknown";

    const errorMetadata = {
      $metadata: metadata,
      $fault: response.statusCode <= 500 ? ("client" as const) : ("server" as const),
    };

    let namespace = this.options.defaultNamespace;
    if (errorName.includes("#")) {
      [namespace] = errorName.split("#");
    }

    const registry = this.compositeErrorRegistry;

    const nsRegistry = TypeRegistry.for(namespace);
    registry.copyFrom(nsRegistry);

    let errorSchema: StaticErrorSchema;
    try {
      errorSchema = registry.getSchema(errorName) as StaticErrorSchema;
    } catch (ignored) {
      if (dataObject.Message) {
        dataObject.message = dataObject.Message;
      }
      const syntheticRegistry = TypeRegistry.for("smithy.ts.sdk.synthetic." + namespace);
      registry.copyFrom(syntheticRegistry);

      const baseExceptionSchema = registry.getBaseException();
      if (baseExceptionSchema) {
        const ErrorCtor = registry.getErrorCtor(baseExceptionSchema);
        throw Object.assign(new ErrorCtor({ name: errorName }), errorMetadata, dataObject);
      }
      throw Object.assign(new Error(errorName), errorMetadata, dataObject);
    }

    const ns = NormalizedSchema.of(errorSchema);
    const ErrorCtor = registry.getErrorCtor(errorSchema);
    const message = dataObject.message ?? dataObject.Message ?? "Unknown";
    const exception = new ErrorCtor({});

    const output = {} as any;
    const errorDeserializer = this.codec.createDeserializer() as JsonShapeDeserializer2;
    for (const [name, member] of ns.structIterator()) {
      if (dataObject[name] != null) {
        output[name] = errorDeserializer.readObject(member, dataObject[name]);
      }
    }

    throw Object.assign(
      exception,
      errorMetadata,
      {
        $fault: ns.getMergedTraits().error,
        message,
      },
      output
    );
  }

  protected getDefaultContentType(): string {
    return "application/json";
  }
}
