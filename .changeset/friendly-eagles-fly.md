---
"@smithy/util-stream": patch
---

Handle backpressure in ChecksumStream by deferring write callbacks when downstream buffer is full, resuming when \_read is called.
