import { AwsCredentialIdentity } from "@smithy-io/types";

/**
 * @internal
 */
export interface InstanceMetadataCredentials extends AwsCredentialIdentity {
  readonly originalExpiration?: Date;
}
