---
"@smithy/core": patch
---

Emit only `Uint8Array` chunks from the browser `getAwsChunkedEncodingStream`, so `fetch` accepts the aws-chunked `ReadableStream` request body (fixes `TypeError: ReadableStream used as a Request or Response body must produce Uint8Array values`). The trailing checksum is now computed from the streamed bytes, and empty source chunks no longer terminate the body early.
