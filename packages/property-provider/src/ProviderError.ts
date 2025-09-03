import type { Logger } from "@smithy/types";

/**
 * @public
 */
export type ProviderErrorOptionsType = {
  tryNextLink?: boolean | undefined;
  logger?: Logger;
};

/**
 * @public
 *
 * An error representing a failure of an individual provider.
 *
 * This error class has special meaning to the {@link chain} method. If a
 * provider in the chain is rejected with an error, the chain will only proceed
 * to the next provider if the value of the `tryNextLink` property on the error
 * is truthy. This allows individual providers to halt the chain and also
 * ensures the chain will stop if an entirely unexpected error is encountered.
 */
export class ProviderError extends Error {
  name = "ProviderError";
  public readonly tryNextLink: boolean;

  /**
   * @deprecated constructor should be given a logger.
   */
  public constructor(message: string);
  /**
   * @deprecated constructor should be given a logger.
   */
  public constructor(message: string, tryNextLink: boolean | undefined);
  /**
   * This signature is preferred for logging capability.
   */
  public constructor(message: string, options: ProviderErrorOptionsType);
  public constructor(message: string, options: boolean | ProviderErrorOptionsType = true) {
    let logger: Logger | undefined;
    let tryNextLink: boolean = true;

    if (typeof options === "boolean") {
      logger = undefined;
      tryNextLink = options;
    } else if (options != null && typeof options === "object") {
      logger = options.logger;
      tryNextLink = options.tryNextLink ?? true;
    }
    super(message);
    this.tryNextLink = tryNextLink;
    Object.setPrototypeOf(this, ProviderError.prototype);
    logger?.debug?.(`@smithy/property-provider ${tryNextLink ? "->" : "(!)"} ${message}`);
  }

  /**
   * @deprecated use new operator.
   */
  static from(error: Error, options: boolean | ProviderErrorOptionsType = true): ProviderError {
    return Object.assign(new this(error.message, options as ProviderErrorOptionsType), error);
  }
}
