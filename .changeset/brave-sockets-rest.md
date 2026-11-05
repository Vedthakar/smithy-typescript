---
"@smithy/node-http-handler": patch
---

Reject requests whose sockets are closed by `NodeHttpHandler.destroy()` with a non-retryable `AbortError`, so they are no longer retried on a fresh socket. The handler remains usable after `destroy()`.
