import { Endpoint } from "./http";
import { RequestHandler } from "./transfer";
import { Decoder, Encoder, Provider } from "./util";

/**
 * @public
 *
 * Interface for object requires an Endpoint set.
 */
export interface EndpointBearer {
  /* TODO(endpointsv2) post-release */
  // Keep using Endpoint V1 interface in serde
  // After all services have onboard EndpointV2, we need to migrate it to Endpoint V2 interface too.
  endpoint: Provider<Endpoint>;
}

/**
 * @public
 */
export interface StreamCollector {
  /**
   * A function that converts a stream into an array of bytes.
   *
   * @param stream - The low-level native stream from browser or Nodejs runtime
   */
  (stream: any): Promise<Uint8Array>;
}

/**
 * @public
 *
 * Request and Response serde util functions and settings for AWS services
 */
export interface SerdeContext extends EndpointBearer {
  base64Encoder: Encoder;
  base64Decoder: Decoder;
  utf8Encoder: Encoder;
  utf8Decoder: Decoder;
  streamCollector: StreamCollector;
  requestHandler: RequestHandler<any, any>;
  disableHostPrefix: boolean;
}
