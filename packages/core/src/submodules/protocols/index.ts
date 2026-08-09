export { collectBody } from "./collect-stream-body";
export { extendedEncodeURIComponent } from "./extended-encode-uri-component";
export { HttpBindingProtocol } from "./HttpBindingProtocol";
export { HttpProtocol } from "./HttpProtocol";
export { RpcProtocol } from "./RpcProtocol";
export { RequestBuilder, requestBuilder } from "./requestBuilder";
export { resolvedPath } from "./resolve-path";
export { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";
export { HttpInterceptingShapeDeserializer } from "./serde/HttpInterceptingShapeDeserializer";
export { HttpInterceptingShapeSerializer } from "./serde/HttpInterceptingShapeSerializer";
export { ToStringShapeSerializer } from "./serde/ToStringShapeSerializer";
export { determineTimestampFormat } from "./serde/determineTimestampFormat";
export { SerdeContext } from "./SerdeContext";

// @smithy/protocol-http
export { Field } from "./protocol-http/Field";
export { Fields, type FieldsOptions } from "./protocol-http/Fields";
export { type HttpHandler, type HttpHandlerUserInput } from "./protocol-http/httpHandler";
export { HttpRequest, type IHttpRequest } from "@smithy/core/transport";
export { HttpResponse } from "@smithy/core/transport";
export { isValidHostname } from "@smithy/core/transport";
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
export { parseQueryString } from "@smithy/core/transport";

// @smithy/url-parser
export { parseUrl } from "@smithy/core/transport";
