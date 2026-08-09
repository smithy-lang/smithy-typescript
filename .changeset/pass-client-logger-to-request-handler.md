---
"@smithy/core": minor
"@smithy/node-http-handler": minor
"@smithy/undici-http-handler": minor
---

feat: offer the client logger to request handlers as a fallback, without overwriting a handler's own logger. A NoOpLogger is not offered, so handlers keep their own console-based defaults.

fix: `getHttpHandlerExtensionConfiguration` and `resolveHttpHandlerRuntimeConfig` now read and write `requestHandler` instead of `httpHandler`, which is the field clients actually populate. This changes the shape of the internal `HttpHandlerExtensionConfigType` and of the object returned by `resolveHttpHandlerRuntimeConfig`.
