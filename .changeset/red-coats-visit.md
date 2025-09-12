---
"@smithy/credential-provider-imds": minor
---

The configuration maxRetries was changed to maxAttempts in middleware-retry to be compliant with other SDKs and retry strategy #1244. This change adds new configuration maxAttempts in RemoteProviderConfig and deprecates maxRetries.
