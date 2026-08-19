/**
 * The barrel is what every downstream repository imports. A re-export dropped
 * here is invisible to every other test in this repository and breaks
 * mc-worldgen, so it is pinned explicitly.
 *
 * It also pins the FROZEN CONTRACT (plan.md §3.2) with golden values: if a
 * constant, the PRNG, the fade curve or a channel salt changes, these fail and
 * the author is forced to notice that they have just regenerated every world
 * that has ever been saved. See docs/versioning.md.
 */
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as noise from '../src/index'

describe('public API surface', () => {
  it.effect('re-exports every value mc-worldgen is expected to import', () =>
    Effect.sync(() => {
      const expected = [
        // seed
        'NoiseSeed',
        'CHANNEL_SALT',
        'NOISE_CHANNELS',
        'deriveSeed',
        'mulberry32',
        'toUint32',
        // perlin
        'PERMUTATION_SIZE',
        'buildPermutation',
        'createPerlinNoise2D',
        'createPerlinNoise2DIsotropic',
        'createPerlinNoise3D',
        // octaves
        'normalizeNoise',
        'clampSigned',
        'DEFAULT_OCTAVE_PARAMS',
        'computeOctaveNoise',
        'octaveNoise2D',
        'signedFbm2D',
        // Minecraft-facing primitive assembly
        'createNoisePrimitives',
        'WEYL_C',
        'WEYL_E',
        'WEYL_W',
        'WEYL_J',
        'WEYL_3D',
        'noise2DBatchXY',
        'octaveNoise2DBatchXY',
        'noise3DBatchXYZ',
        'noise2DBatch',
        'octaveNoise2DBatch',
        'CHUNK_COLUMN_SAMPLE_COUNT',
        'TERRAIN_SAMPLE_STEP',
        'computeTerrainChannels',
        'toPV',
        // value noise
        'channelSeed',
        'latticeValue',
        'valueNoise2D',
        'fbm2D',
        // transforms
        'peaksAndValleysFromWeirdness',
        // splines
        'createSpline',
        'evaluateSpline',
        // Sampling
        'sampleNoise3DBatch',
        'sampleNoise3DGrid',
        'sampleNoise3DInterpolatedGrid',
        'sampleNoise2DBatch',
        'sampleNoise2DGrid',
        'sampleNoise2DInterpolatedGrid',
        'sampleNoise2DChunk',
        'sampleNoise3DChunk',
        // Simplex and DensityFunction
        'createSimplexNoise2D',
        'createSimplexNoise3D',
        'createDensityNoiseSource',
        'densityConstant',
        'densityZero',
        'densityCoordinate',
        'densityNoise',
        'densityShift',
        'densityShiftA',
        'densityShiftB',
        'densityShiftedNoise',
        'densityShiftedNoise2D',
        'densityNoiseInRange',
        'densityMappedNoise',
        'densityMap',
        'densityMapRange',
        'densityLerp',
        'densityLinearOperation',
        'densityWeirdScaledSampler',
        'densityEndIslands',
        'densityBinary',
        'densityAdd',
        'densityMul',
        'densityMin',
        'densityMax',
        'densityUnary',
        'densityAbs',
        'densitySquare',
        'densityCube',
        'densityHalfNegative',
        'densityQuarterNegative',
        'densitySqueeze',
        'densityInvert',
        'densityClamp',
        'densityRangeChoice',
        'densityYClampedGradient',
        'densitySpline',
        'densityInterpolated',
        'densityFlatCache',
        'densityCache2D',
        'densityCacheOnce',
        'densityCacheAllInCell',
        'densityBlendDensity',
        'densityBlendAlpha',
        'densityBlendOffset',
        'interpolated',
        'flatCache',
        'cache2d',
        'cacheOnce',
        'cacheAllInCell',
        'blendDensity',
        'blendAlpha',
        'blendOffset',
        'createDensityEvaluationContext',
        'createDensityEvaluationSession',
        'densityBounds',
        'evaluateDensityFunction',
        'computeDensityFunction',
        'fillDensityFunctionArray',
        'mapAllDensityFunction',
        'densityFunctionMinValue',
        'densityFunctionMaxValue',
        'createDensityFunctionRuntime',
        'createDensityFunctionNode',
        // Official DensityFunctions factory names
        'zero',
        'constant',
        'noise',
        'shift',
        'shiftA',
        'shiftB',
        'add',
        'mul',
        'min',
        'max',
        'weirdScaledSampler',
        'endIslands',
        'lerp',
        'DensityMappedType',
        'map',
        'mappedNoise',
        'rangeChoice',
        'shiftedNoise2d',
        'createDensitySpline',
        'spline',
        'yClampedGradient',
        // Official routing and evaluation context
        'isDensityFunction',
        'requireDensityFunction',
        'NOISE_ROUTER_CHANNELS',
        'createNoiseRouter',
        'requireNoiseRouter',
        'isNoiseRouter',
        'mapNoiseRouter',
        'mapAllNoiseRouter',
        'createNoiseRouterRuntime',
        'evaluateNoiseRouter',
        'CLIMATE_PARAMETER_COUNT',
        'CLIMATE_HYPERCUBE_DIMENSION',
        'CLIMATE_QUANTIZATION_FACTOR',
        'CLIMATE_CHANNELS',
        'quantizeCoord',
        'unquantizeCoord',
        'createClimateParameterFromQuantized',
        'climateParameter',
        'climateParameterRange',
        'isClimateParameter',
        'requireClimateParameter',
        'climateParameterSpan',
        'point',
        'span',
        'createClimateParameterSpace',
        'createClimateParameterPointFromQuantized',
        'isClimateParameterPoint',
        'requireClimateParameterPoint',
        'climateParameters',
        'parameters',
        'parameterPoint',
        'createClimateTargetPointFromQuantized',
        'climateTarget',
        'target',
        'isClimateTargetPoint',
        'climateParameterDistance',
        'climateParameterSpace',
        'climateParameterPointFitness',
        'createClimateParameterList',
        'requireClimateParameterList',
        'findClimateValueIndex',
        'findClimateValue',
        'findClimateValueBruteForce',
        'createClimateSampler',
        'createClimateSamplerRuntime',
        'empty',
        'requireClimateSampler',
        'isClimateSampler',
        'sampleClimate',
        'sampleClimateAt',
        'findClimateSpawnPosition',
        'findSpawnPosition',
        'createBlender',
        'emptyBlender',
        'requireBlender',
        'createDensityEvaluationContextFromBlender',
        // field
        'CHANNEL_PARAMS',
        'createIsotropicNoiseField',
        'createNoiseField',
      ]
      const actual = new Set(Object.keys(noise))
      for (const name of expected) {
        expect(actual.has(name)).toBe(true)
      }
    }),
  )

  it.effect('supports official DensityFunctions factory names', () =>
    Effect.sync(() => {
      const source = noise.createDensityNoiseSource(
        () => 0.25,
        { minValue: -1, maxValue: 1 },
      )
      const input = noise.constant(0.5)

      expect(noise.zero().kind).toBe('constant')
      expect(noise.constant(1).kind).toBe('constant')
      expect(noise.noise(source).kind).toBe('noise')
      expect(noise.noise(source, 2).kind).toBe('noise')
      expect(noise.noise(source, 2, 3).kind).toBe('noise')
      expect(noise.shift(source).kind).toBe('shift')
      expect(noise.shiftA(source).kind).toBe('shift-a')
      expect(noise.shiftB(source).kind).toBe('shift-b')
      expect(noise.add(input, input).kind).toBe('binary')
      expect(noise.mul(input, input).kind).toBe('binary')
      expect(noise.min(input, input).kind).toBe('binary')
      expect(noise.max(input, input).kind).toBe('binary')
      expect(
        noise.weirdScaledSampler(input, source, 'type-1').kind,
      ).toBe('weird-scaled-sampler')
      expect(noise.endIslands(0n).kind).toBe('end-islands')
      expect(noise.lerp(input, 0, input).kind).toBe('binary')
      expect(noise.map(input, noise.DensityMappedType.ABS).kind).toBe('unary')
      expect(
        noise.map(input, noise.DensityMappedType.SQUARE).kind,
      ).toBe('unary')
      expect(() => noise.map(input, 'unsupported' as never)).toThrow(
        RangeError,
      )
      expect(noise.mappedNoise(source, -1, 1).kind).toBe('binary')
      expect(
        noise.rangeChoice(input, -1, 1, input, noise.zero()).kind,
      ).toBe('range-choice')
      expect(
        noise.shiftedNoise2d(noise.zero(), noise.zero(), 1, source).kind,
      ).toBe('shifted-noise')
      const spline = noise.createDensitySpline(
        noise.zero(),
        noise.createSpline([]),
      )
      expect(noise.spline(spline).kind).toBe('spline')
      expect(noise.yClampedGradient(0, 1, 0, 1).kind).toBe(
        'y-clamped-gradient',
      )
    }),
  )
})

describe('the frozen seed -> value contract', () => {
  // GOLDEN VALUES. Changing any of these means every existing world's terrain
  // has changed. That is a MAJOR version bump plus a migration story, not a
  // refactor. Do not update these numbers to make a build pass.
  const field = noise.createNoiseField(noise.NoiseSeed(20260726))

  it.effect('reproduces its golden samples exactly', () =>
    Effect.sync(() => {
      // Coordinates chosen OFF the half-integer grid on purpose — see the
      // known-artifact test below for why sampling at .5 would make several of
      // these trivially 0 and therefore worthless as goldens.
      expect(field.raw2d(0.3, 0.7)).toMatchInlineSnapshot(`0.32288192685252637`)
      expect(field.raw2d(12.37, -7.13)).toMatchInlineSnapshot(`0.20774690518930813`)
      expect(field.noise2d(3.11, 9.87)).toMatchInlineSnapshot(`0.4878451499725336`)
      expect(field.raw3d(1.3, 2.7, -3.1)).toMatchInlineSnapshot(`-0.06349056477267119`)
      expect(field.octave2d(4.3, -6.9)).toMatchInlineSnapshot(`0.673754747157846`)
      expect(field.channel('continentalness')(100.37, 200.13)).toMatchInlineSnapshot(`-0.06304928108167814`)
      expect(field.channel('erosion')(100.37, 200.13)).toMatchInlineSnapshot(`0.2726603117072621`)
      expect(field.channel('weirdness')(100.37, 200.13)).toMatchInlineSnapshot(`0.5771648589762567`)
      expect(field.channel('jaggedness')(100.37, 200.13)).toMatchInlineSnapshot(`0.5067489289803562`)
    }),
  )

  it.effect('is exactly 0 at every lattice point, which is what gradient noise means', () =>
    Effect.sync(() => {
      // Not a golden value but a structural fact: Perlin noise interpolates
      // gradients, so it vanishes wherever the fractional part is zero. If this
      // ever fails, the kernel is value noise wearing a Perlin costume.
      for (const [x, z] of [
        [0, 0],
        [1, 1],
        [-3, 7],
        [255, -255],
      ] as const) {
        expect(field.raw2d(x, z)).toBe(0)
      }
    }),
  )

  it.effect('KNOWN ARTIFACT: the 4-gradient 2D kernel is often exactly 0 at half-integer coordinates', () =>
    Effect.sync(() => {
      // Documented, not accidental. With the classic four 2D gradients
      // {(1,1), (-1,1), (1,-1), (-1,-1)} and an offset of exactly +/-0.5, every
      // corner dot product lands in {-1, 0, 1}; fade(0.5) is exactly 0.5, so
      // the result is the plain mean of four such values, which is 0 far more
      // often than chance would suggest.
      //
      // Consequences, in increasing order of importance:
      //  - golden samples must not be taken at .5 (see above);
      //  - octave stacks sampled at .5 collapse to their first octave, because
      //    every higher frequency lands on integers;
      //  - block CENTRES are at .5, so a naive "sample the noise at the block
      //    centre" caller would see a visible grid artifact in the terrain.
      //
      // The fix is a larger gradient set (12 directions, as the 3D kernel
      // already uses). That is a change to the FROZEN seed -> value mapping and
      // so is deferred to a deliberate MAJOR bump — see docs/design-notes.md,
      // regression `noise-half-integer-gradient-degeneracy` and the documented legacy mapping.
      const halfIntegerSamples = Array.from({ length: 64 }, (_unused, index) =>
        field.raw2d(index + 0.5, index * 2 + 0.5),
      )
      const zeros = halfIntegerSamples.filter((value) => value === 0).length
      // Pinning the current rate. If a future gradient set fixes this, the
      // number drops and this test fails, which is the intended prompt to
      // update the note above rather than to delete it.
      expect(zeros).toBeGreaterThan(10)
    }),
  )

  it.effect('pins the channel salts, because changing one re-rolls that channel for every world', () =>
    Effect.sync(() => {
      expect(noise.CHANNEL_SALT).toStrictEqual({
        base2d: 0x9e3779b1,
        base3d: 0x9e3779b9,
        continentalness: 0xbb67ae85,
        erosion: 0x3c6ef372,
        weirdness: 0xa54ff53a,
        jaggedness: 0x510e527f,
      })
    }),
  )
})
