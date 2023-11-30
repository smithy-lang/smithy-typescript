/**
 * Alternate compilation for browser excluding http Agent types.
 *
 * @internal
 */
export type DefaultRequestHandlerInitializationPassThroughParameters = FetchHttpHandlerOptions;

/**
 * Copy of the options in @smithy/fetch-http-handler FetchHttpHandler class.
 * Not imported due to dependency ordering.
 */
interface FetchHttpHandlerOptions {
  requestTimeout?: number;
  keepAlive?: boolean;
}
