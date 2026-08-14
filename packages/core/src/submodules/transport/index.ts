/*
 * This is a file-cycle-breaking module and shouldn't have its API expanded.
 * hasOwn is exported here as an exception: transport has zero outgoing
 * @smithy/core/* dependencies (a true sink node), so it is the only
 * submodule that can host a widely shared utility without risking a cycle.
 * Do not add other exports here for convenience.
 */

export { getSmithyContext } from "./getSmithyContext";
export { hasOwn } from "./hasOwn";
export { HttpRequest } from "./httpRequest";
export type { IHttpRequest } from "./httpRequest";
export { HttpResponse } from "./httpResponse";
export { isValidHostLabel } from "./isValidHostLabel";
export { isValidHostname } from "./isValidHostname";
export { normalizeProvider } from "./normalizeProvider";
export { parseQueryString } from "./parseQueryString";
export { parseUrl } from "./parseUrl";
export { toEndpointV1 } from "./toEndpointV1";
