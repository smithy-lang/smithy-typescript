import { deref, NormalizedSchema, TypeRegistry } from "@smithy/core/schema";
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
import { getSmithyContext } from "@smithy/util-middleware";

import { RpcProtocol } from "../RpcProtocol";
import { JsonCodec } from "./JsonCodec";
import type { JsonShapeDeserializer } from "./JsonShapeDeserializer";
import type { JsonShapeSerializer } from "./JsonShapeSerializer";
import { loadSmithyRpcV2JsonErrorCode } from "./parseJsonBody";

/**
 * Client protocol for Smithy RPCv2 JSON.
 *
 * @alpha
 */
export class SmithyRpcV2JsonProtocol extends RpcProtocol {
  /**
   * @override
   */
  protected declare compositeErrorRegistry: TypeRegistry;
  private codec: JsonCodec;
  protected serializer: JsonShapeSerializer;
  protected deserializer: JsonShapeDeserializer;

  public constructor({
    defaultNamespace,
    errorTypeRegistries,
  }: {
    defaultNamespace: string;
    errorTypeRegistries?: TypeRegistry[];
  }) {
    super({ defaultNamespace, errorTypeRegistries });
    this.codec = new JsonCodec({
      timestampFormat: {
        useTrait: true,
        default: 7 as const satisfies TimestampEpochSecondsSchema,
      },
      jsonName: false,
    });
    this.serializer = this.codec.createSerializer();
    this.deserializer = this.codec.createDeserializer();
  }

  public getShapeId(): string {
    return "smithy.protocols#rpcv2Json";
  }

  public getPayloadCodec(): JsonCodec {
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
    } else {
      if (!request.body) {
        this.serializer.write(15, {});
        request.body = this.serializer.flush();
      }
      try {
        request.headers["content-length"] = String((request.body as string).length);
      } catch (e) {}
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
    const errorName = loadSmithyRpcV2JsonErrorCode(response, dataObject) ?? "Unknown";

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
    } catch (e) {
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
    const exception = new ErrorCtor(message);

    const output = {} as any;
    for (const [name, member] of ns.structIterator()) {
      const v = await this.deserializer.read(member, dataObject[name]);
      if (v != null) {
        output[name] = v;
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
