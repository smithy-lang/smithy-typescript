---
"@smithy/core": patch
---

Keep the JSON string serializer's buffer reservation intact after 6-byte escape sequences so that the characters and closing quote that follow are always written within the buffer.
