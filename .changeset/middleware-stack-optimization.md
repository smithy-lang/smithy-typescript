---
"@smithy/middleware-stack": patch
---

Optimize middleware stack performance: add `_addBulk` fast path in `cloneTo` to skip redundant validation when copying entries to empty stacks, cache `getMiddlewareList` result with mutation-based invalidation, replace `map`+`reduce` with `flatMap`, and fix `.reverse()` mutation bug in `expandRelativeMiddlewareList` that could corrupt results on repeated calls.
