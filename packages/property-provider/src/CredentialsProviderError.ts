import { ProviderError, ProviderErrorOptionsType } from "./ProviderError";

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
  name = "CredentialsProviderError";

  /**
   * @override
   * @deprecated constructor should be given a logger.
   */
  public constructor(message: string);
  /**
   * @override
   * @deprecated constructor should be given a logger.
   */
  public constructor(message: string, tryNextLink: boolean | undefined);
  /**
   * @override
   * This signature is preferred for logging capability.
   */
  public constructor(message: string, options: ProviderErrorOptionsType);
  /**
   * @override
   */
  public constructor(message: string, options: boolean | ProviderErrorOptionsType = true) {
    super(message, options as ProviderErrorOptionsType);
    Object.setPrototypeOf(this, CredentialsProviderError.prototype);
  }
}
