import { Effect } from 'effect'
import { it } from '@effect/vitest'

type EffectTestBody = () => Effect.Effect<void, never, never>

export const effectTest = (name: string, body: EffectTestBody): void => {
  it.effect(name, body)
}
