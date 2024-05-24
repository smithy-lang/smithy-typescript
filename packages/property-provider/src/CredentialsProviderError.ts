import { Logger } from "@smithy/types";

import { ProviderError } from "./ProviderError";

/**
 * @public
 */
export type CredentialsProviderErrorOptionsType = {
  tryNextLink?: boolean | undefined;
  logger?: Logger;
};

/**
 * @public
 *
 * An error representing a failure of an individual credential provider.
 *
 * This error class has special meaning to the {@link chain} method. If a
 * provider in the chain is rejected with an error, the chain will only proceed
 * to the next provider if the value of the `tryNextLink` property on the error
 * is truthy. This allows individual providers to halt the chain and also
 * ensures the chain will stop if an entirely unexpected error is encountered.
 */
export class CredentialsProviderError extends ProviderError {
  public name = "CredentialsProviderError";
  public readonly tryNextLink: boolean = true;

  /**
   * @deprecated constructor should be given a logger.
   */
  public constructor(message: string);
  /**
   * @deprecated constructor should be given a logger.
   */
  public constructor(message: string, tryNextLink?: boolean | undefined);
  /**
   * This signature is preferred for logging capability.
   */
  public constructor(message: string, options: CredentialsProviderErrorOptionsType);
  public constructor(message: string, options: boolean | CredentialsProviderErrorOptionsType = true) {
    let logger: Logger | undefined;
    let tryNextLink: boolean = true;

    if (typeof options === "boolean") {
      logger = undefined;
      tryNextLink = options;
    } else if (options != null && typeof options === "object") {
      logger = options.logger;
      tryNextLink = options.tryNextLink ?? true;
    }
    super(message, tryNextLink);

    Object.setPrototypeOf(this, CredentialsProviderError.prototype);
    logger?.trace?.(`${new Date().toISOString()} ${tryNextLink ? "->" : "(!)"} ${message}`);
  }
}
