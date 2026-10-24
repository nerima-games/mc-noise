---
'@nerima-games/mc-noise': minor
---

Migrate to Effect 4 and mc-kernel 0.9.0. Public scalar inputs now use domain brands, and invalid inputs return typed `Result` or `Option` values instead of throwing. Consumers must update affected constructors, coordinate brands, and failure handling.
