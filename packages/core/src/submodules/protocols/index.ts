export * from "./collect-stream-body";
export * from "./extended-encode-uri-component";
export * from "./HttpBindingProtocol";
export * from "./HttpProtocol";
export * from "./RpcProtocol";
export * from "./requestBuilder";
export * from "./resolve-path";
export * from "./serde/FromStringShapeDeserializer";
export * from "./serde/HttpInterceptingShapeDeserializer";
export * from "./serde/HttpInterceptingShapeSerializer";
export * from "./serde/ToStringShapeSerializer";
export * from "./serde/determineTimestampFormat";
export * from "./SerdeContext";

// @smithy/protocol-http
export { Field } from "./protocol-http/Field";
export { Fields, type FieldsOptions } from "./protocol-http/Fields";
export { type HttpHandler, type HttpHandlerUserInput } from "./protocol-http/httpHandler";
export { HttpRequest, type IHttpRequest } from "./protocol-http/httpRequest";
export { HttpResponse } from "./protocol-http/httpResponse";
export { isValidHostname } from "./protocol-http/isValidHostname";
export {
  getHttpHandlerExtensionConfiguration,
  resolveHttpHandlerRuntimeConfig,
  type HttpHandlerExtensionConfiguration,
  type HttpHandlerExtensionConfigType,
} from "./protocol-http/extensions/httpExtensionConfiguration";
export {
  type FieldOptions,
  type FieldPosition,
  type HeaderBag,
  type HttpMessage,
  type HttpHandlerOptions,
} from "./protocol-http/types";

// @smithy/middleware-content-length
export {
  contentLengthMiddleware,
  contentLengthMiddlewareOptions,
  getContentLengthPlugin,
} from "./middleware-content-length/contentLengthMiddleware";

// @smithy/util-uri-escape
export { escapeUri } from "./util-uri-escape/escape-uri";
export { escapeUriPath } from "./util-uri-escape/escape-uri-path";

// @smithy/querystring-builder
export { buildQueryString } from "./querystring-builder/buildQueryString";

// @smithy/querystring-parser
export { parseQueryString } from "./querystring-parser/parseQueryString";

// @smithy/url-parser
export { parseUrl } from "./url-parser/parseUrl";
