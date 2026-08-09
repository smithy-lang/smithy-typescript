/**
 * Key with which a client offers its logger to an HttpHandler via
 * `updateHttpClientConfig`, to be used only if the handler has no logger
 * of its own.
 *
 * A symbol keeps this off the handlers' public options types, and being a
 * symbol already distinguishes it from the `"logger"` string key.
 * `Symbol.for` means handlers can declare their own copy of this key and
 * still compare equal to it.
 *
 * @internal
 */
export const FALLBACK_LOGGER = Symbol.for("logger");
