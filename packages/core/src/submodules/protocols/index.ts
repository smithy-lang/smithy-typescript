export { collectBody } from "./collect-stream-body";
export { extendedEncodeURIComponent } from "./extended-encode-uri-component";
export { HttpBindingProtocol } from "./HttpBindingProtocol";
export { HttpProtocol } from "./HttpProtocol";
export { RpcProtocol } from "./RpcProtocol";
export { requestBuilder, RequestBuilder } from "./requestBuilder";
export { resolvedPath } from "./resolve-path";
export { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";
export { HttpInterceptingShapeDeserializer } from "./serde/HttpInterceptingShapeDeserializer";
export { HttpInterceptingShapeSerializer } from "./serde/HttpInterceptingShapeSerializer";
export { ToStringShapeSerializer } from "./serde/ToStringShapeSerializer";
export { determineTimestampFormat } from "./serde/determineTimestampFormat";
export { SerdeContext } from "./SerdeContext";

// formerly @smithy/protocol-http
export {
  HttpHandlerExtensionConfiguration,
  HttpHandlerExtensionConfigType,
  getHttpHandlerExtensionConfiguration,
  resolveHttpHandlerRuntimeConfig,
} from "./protocol-http/extensions/httpExtensionConfiguration";
export { Field } from "./protocol-http/Field";
export { FieldsOptions, Fields } from "./protocol-http/Fields";
export { HttpHandler, HttpHandlerUserInput } from "./protocol-http/httpHandler";
export { HttpRequest, IHttpRequest } from "./protocol-http/httpRequest";
export { HttpResponse } from "./protocol-http/httpResponse";
export { isValidHostname } from "./protocol-http/isValidHostname";
export { FieldOptions, FieldPosition, HeaderBag, HttpMessage, HttpHandlerOptions } from "./protocol-http/types";

// formerly @smithy/middleware-content-length
export {
  contentLengthMiddleware,
  contentLengthMiddlewareOptions,
  getContentLengthPlugin,
} from "./middleware-content-length/middleware-content-length";

// formerly @smithy/middleware-apply-body-checksum
export {
  applyMd5BodyChecksumMiddleware,
  applyMd5BodyChecksumMiddlewareOptions,
  getApplyMd5BodyChecksumPlugin,
} from "./middleware-apply-body-checksum/applyMd5BodyChecksumMiddleware";
export {
  Md5BodyChecksumInputConfig,
  Md5BodyChecksumResolvedConfig,
  resolveMd5BodyChecksumConfig,
} from "./middleware-apply-body-checksum/md5Configuration";

// formerly @smithy/util-body-length-browser
// and @smithy/util-body-length-node
export { calculateBodyLength } from "./util-body-length/calculateBodyLength";
