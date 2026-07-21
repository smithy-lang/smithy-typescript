---
"@smithy/core": minor
"@smithy/node-http-handler": minor
"@smithy/undici-http-handler": minor
---

feat: pass client logger to request handlers

Injects the client-level logger into the request handler during
`getHttpHandlerExtensionConfiguration`, so handler-emitted diagnostics
(e.g. socket exhaustion warnings) route through the customer's logger
instead of `console.warn`.

Skips injection when the logger is `NoOpLogger` (the default),
preserving the existing console fallback for customers who never set a logger.
Handler-level loggers take precedence via nullish assignment in
`updateHttpClientConfig`.
