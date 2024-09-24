import { HttpRequest } from "@smithy/protocol-http";
import {
  AbsoluteLocation,
  BuildHandler,
  BuildHandlerArguments,
  BuildHandlerOptions,
  BuildHandlerOutput,
  BuildMiddleware,
  MetadataBearer,
} from "@smithy/types";

import { compressStream } from "./compressStream";
import { compressString } from "./compressString";
import { CompressionPreviouslyResolved, CompressionResolvedConfig } from "./configurations";
import { CLIENT_SUPPORTED_ALGORITHMS, CompressionAlgorithm } from "./constants";
import { isStreaming } from "./isStreaming";

/**
 * @internal
 */
export interface CompressionMiddlewareConfig {
  /**
   * Defines the priority-ordered list of compression algorithms supported by the service operation.
   */
  encodings: string[];

  /**
   * Indicates that the streaming blob MUST be finite and have a known size when sending data from a client to a server.
   * Populated if smithy requiresLength is set https://smithy.io/2.0/spec/streaming.html#requireslength-trait
   */
  streamRequiresLength?: boolean;
}

/**
 * @internal
 */
export const compressionMiddleware =
  (
    config: CompressionResolvedConfig & CompressionPreviouslyResolved,
    middlewareConfig: CompressionMiddlewareConfig
  ): BuildMiddleware<any, any> =>
  <Output extends MetadataBearer>(next: BuildHandler<any, Output>): BuildHandler<any, Output> =>
  async (args: BuildHandlerArguments<any>): Promise<BuildHandlerOutput<Output>> => {
    if (!HttpRequest.isInstance(args.request)) {
      return next(args);
    }

    const disableRequestCompression = await config.disableRequestCompression();
    if (disableRequestCompression) {
      return next(args);
    }

    const { request } = args;
    const { body, headers } = request;
    const { encodings, streamRequiresLength } = middlewareConfig;

    let updatedBody = body;
    let updatedHeaders = headers;

    for (const algorithm of encodings) {
      if (CLIENT_SUPPORTED_ALGORITHMS.includes(algorithm as CompressionAlgorithm)) {
        let isRequestCompressed = false;
        if (isStreaming(body)) {
          if (!streamRequiresLength) {
            updatedBody = await compressStream(body);
            isRequestCompressed = true;
          } else {
            // Invalid case. We should never get here.
            throw new Error("Compression is not supported for streaming blobs that require a length.");
          }
        } else {
          const bodyLength = config.bodyLengthChecker(body);
          const requestMinCompressionSizeBytes = await config.requestMinCompressionSizeBytes();
          if (bodyLength && bodyLength >= requestMinCompressionSizeBytes) {
            updatedBody = await compressString(body);
            isRequestCompressed = true;
          }
        }

        if (isRequestCompressed) {
          // Either append to the header if it already exists, else set it
          if (headers["content-encoding"]) {
            updatedHeaders = {
              ...headers,
              "content-encoding": `${headers["content-encoding"]},${algorithm}`,
            };
          } else {
            updatedHeaders = { ...headers, "content-encoding": algorithm };
          }

          // We've matched on one supported algorithm in the
          // priority-ordered list, so we're finished.
          break;
        }
      }
    }

    return next({
      ...args,
      request: {
        ...request,
        body: updatedBody,
        headers: updatedHeaders,
      },
    });
  };

export const compressionMiddlewareOptions: BuildHandlerOptions & AbsoluteLocation = {
  name: "compressionMiddleware",
  step: "build",
  tags: ["REQUEST_BODY_COMPRESSION", "GZIP"],
  override: true,
  priority: "high",
};
