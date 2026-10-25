import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as api from '../src/index.js'
import {
  NOISE_API_PARITY_BASELINE,
  captureNoiseApiParitySamples,
} from './noise-api-parity-support.js'

const fixture: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/noise-api-parity.json', import.meta.url), 'utf8'),
)

describe('fixed-seed public API parity', () => {
  it('matches all 39 outputs captured from origin/main', () => {
    const samples = captureNoiseApiParitySamples(api)

    expect(samples).toHaveLength(39)
    expect(samples.some((sample) => sample.id === 'density.end-islands.seed-42')).toBe(true)
    expect(samples.some((sample) => sample.id === 'noise.simplex.2d')).toBe(true)
    expect(samples.some((sample) => sample.id === 'noise.simplex.3d')).toBe(true)
    expect(samples.some((sample) => sample.id === 'noise.value.fbm2D')).toBe(true)
    expect(fixture).toEqual({
      baselineCommit: NOISE_API_PARITY_BASELINE,
      samples,
      schemaVersion: 1,
    })
  })
})
