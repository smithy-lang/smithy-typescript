/**
 * Key with which a client offers its logger to an HttpHandler via
 * `updateHttpClientConfig`, to be used only if the handler has no logger
 * of its own.
 *
 * A symbol keeps this off the handlers' public options types. `Symbol.for`
 * makes the key shared between duplicate copies of this package.
 *
 * @internal
 */
export const FALLBACK_LOGGER: unique symbol = Symbol.for("smithy.httpHandler.fallbackLogger");
