---
"@smithy/node-http-handler": patch
"@smithy/fetch-http-handler": patch
---

fix: do not return caller's Error directly from buildAbortError

Always create a new mutable Error when the abort reason is an Error, preserving the original via `.cause`. Fixes TypeError when retry middleware tries to set `$metadata` on a frozen/sealed abort reason.
