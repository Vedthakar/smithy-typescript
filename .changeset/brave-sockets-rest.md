---
"@smithy/node-http-handler": patch
---

Reject in-flight and new requests with a non-retryable `AbortError` after `NodeHttpHandler.destroy()`, so destroyed clients no longer retry on a fresh socket.
