import { isStreamingPayload } from "./middleware-retry/isStreamingPayload/isStreamingPayload.browser";

/**
 * @internal
 */
export const container: {
  isStreamingPayload: typeof isStreamingPayload;
} = {
  isStreamingPayload,
};
