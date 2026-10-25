---
'@nerima-games/mc-noise': minor
---

Migrate to Effect 4 and mc-kernel 0.9.0. Fallible operations return typed
`Result` values. `Option` represents absence and can be nested in `Result` when
validation can also fail. Use brand constructors' `.result` methods for
untrusted inputs; direct brand constructor calls throw on invalid values.
Consumers must update seed and coordinate brands and handle returned values.
