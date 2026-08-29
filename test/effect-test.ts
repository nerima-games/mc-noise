import { Effect } from 'effect'
import { it } from 'vitest'

type EffectTestBody = () => Effect.Effect<void, never, never>

export const effectTest = (name: string, body: EffectTestBody): void => {
  it(name, () => Effect.runSync(body()))
}
