import { CredentialsProviderError } from "@smithy/property-provider";

/**
 * @public
 *
 * A specific sub-case of CredentialsProviderError, when the IMDSv1 fallback
 * has been attempted but shut off by SDK configuration.
 */
export class InstanceMetadataV1FallbackError extends CredentialsProviderError {
  public name = "InstanceMetadataV1FallbackError";

  constructor(message: string, public readonly tryNextLink: boolean = true) {
    super(message, tryNextLink);
    Object.setPrototypeOf(this, InstanceMetadataV1FallbackError.prototype);
  }
}
