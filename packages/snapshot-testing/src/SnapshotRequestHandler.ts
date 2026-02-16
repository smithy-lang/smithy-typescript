import { NormalizedSchema } from "@smithy/core/schema";
import { type HttpHandler } from "@smithy/protocol-http";
import type {
  HttpHandlerOptions,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  Logger,
  RequestHandlerOutput,
} from "@smithy/types";

import { serializeHttpRequest } from "./serializers/serializeHttpRequest";
import { RequestSnapshotCompleted } from "./snapshot-testing-types";

/**
 * @internal
 */
export interface SnapshotRequestHandlerOptions {
  /**
   * The serialized request will be pushed to the logger's trace method.
   */
  logger?: Logger;
}

/**
 * @internal
 */
interface ResolvedSnapshotRequestHandlerOptions extends SnapshotRequestHandlerOptions {}

/**
 * @internal
 */
export class SnapshotRequestHandler implements HttpHandler<SnapshotRequestHandlerOptions> {
  private readonly config: ResolvedSnapshotRequestHandlerOptions;

  public constructor(options: SnapshotRequestHandlerOptions = {}) {
    this.config = {
      logger: console,
      ...options,
    };
  }

  public async handle(
    request: IHttpRequest,
    handlerOptions: (HttpHandlerOptions & any) | undefined = {}
  ): Promise<RequestHandlerOutput<IHttpResponse>> {
    const { logger } = this.config;

    const [client, [, namespace, name, traits, input, output], command] = [
      handlerOptions[Symbol.for("$client")],
      handlerOptions[Symbol.for("$schema")],
      handlerOptions[Symbol.for("$command")],
    ];

    const requestSerialization = await serializeHttpRequest(request);
    logger?.trace?.(requestSerialization);

    const $out = NormalizedSchema.of(output);

    const eventStreamOutput = $out.getEventStreamMember();
    const hasDataStreamResponsePayload = Object.values($out.getMemberSchemas()).some(
      ($) => $.isStreaming() && $.isBlobSchema()
    );
    void [client, namespace, name, traits, input, command, eventStreamOutput, hasDataStreamResponsePayload];

    throw new RequestSnapshotCompleted();
  }

  public updateHttpClientConfig(
    key: keyof SnapshotRequestHandlerOptions,
    value: SnapshotRequestHandlerOptions[typeof key]
  ): void {
    this.config[key] = value;
  }

  public httpHandlerConfigs(): SnapshotRequestHandlerOptions {
    return this.config;
  }
}
