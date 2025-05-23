import { FinalizeHandler, FinalizeHandlerArguments, MetadataBearer, Provider } from "@smithy/types";
import { DefaultRateLimiter, RateLimiter, RETRY_MODES } from "@smithy/util-retry";

import { StandardRetryStrategy, StandardRetryStrategyOptions } from "./StandardRetryStrategy";

/**
 * @public
 * Strategy options to be passed to AdaptiveRetryStrategy
 */
export interface AdaptiveRetryStrategyOptions extends StandardRetryStrategyOptions {
  rateLimiter?: RateLimiter;
}

/**
 * @public
 * @deprecated use AdaptiveRetryStrategy from @smithy/util-retry
 */
export class AdaptiveRetryStrategy extends StandardRetryStrategy {
  private rateLimiter: RateLimiter;

  constructor(maxAttemptsProvider: Provider<number>, options?: AdaptiveRetryStrategyOptions) {
    const { rateLimiter, ...superOptions } = options ?? {};
    super(maxAttemptsProvider, superOptions);
    this.rateLimiter = rateLimiter ?? new DefaultRateLimiter();
    this.mode = RETRY_MODES.ADAPTIVE;
  }

  async retry<Input extends object, Ouput extends MetadataBearer>(
    next: FinalizeHandler<Input, Ouput>,
    args: FinalizeHandlerArguments<Input>
  ) {
    return super.retry(next, args, {
      beforeRequest: async () => {
        return this.rateLimiter.getSendToken();
      },
      afterRequest: (response: any) => {
        this.rateLimiter.updateClientSendingRate(response);
      },
    });
  }
}
