---
"@smithy/util-waiter": patch
---

fix(util-waiter): add optional chaining for `$response?.statusCode` in `createMessageFromResponse` to prevent TypeError when `$response` is undefined but `message` is present.
