/**
 * The barrel is what every downstream repository imports. A re-export dropped
 * here is invisible to every other test in this repository and breaks
 * mc-worldgen, so it is pinned explicitly.
 *
 * It also pins the versioned seed -> value contract (docs/versioning.md §5) with
 * golden values: if a constant, the PRNG, the fade curve or a channel salt
 * changes, these fail and the author must review the intentional terrain change.
 */
import { describe, expect } from 'vitest'
import { effectTest } from './effect-test'
import { Effect } from 'effect'
import * as noise from '../src/index'

describe('public API surface', () => {
  effectTest('re-exports every value mc-worldgen is expected to import', () =>
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
        'createDensityOldBlendedNoiseSource',
        'densityConstant',
        'densityZero',
        'densityCoordinate',
        'densityNoise',
        'densityOldBlendedNoise',
        'densityBeardifier',
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
        'densityFindTopSurface',
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
        // Minecraft biome, terrain, lake, and surface definitions
        'MINECRAFT_BIOMES',
        'MINECRAFT_CHUNK_BIOMES',
        'MINECRAFT_FALLBACK_BIOME',
        'classifyMinecraftBiome',
        'MINECRAFT_BLOCK',
        'MINECRAFT_BIOME_SURFACES',
        'MINECRAFT_BIOME_TREE_DENSITY',
        'minecraftPeaksAndValleysFromWeirdness',
        'classifyMinecraftBiomeFromClimate',
        'refineMinecraftBeachBiome',
        'MINECRAFT_MIN_SURFACE_Y',
        'MINECRAFT_MAX_SURFACE_Y',
        'MINECRAFT_CONTINENTALNESS_CONTRAST',
        'MINECRAFT_SEA_LEVEL',
        'MINECRAFT_LAKE_LEVEL',
        'MINECRAFT_DEFAULT_TERRAIN_LEVELS',
        'minecraftContinentalnessAt',
        'minecraftSurfaceHeightFromContinentalness',
        'minecraftSurfaceHeightAt',
        'minecraftClimateAt',
        'minecraftSurfaceBiomeAt',
        'minecraftBiomeFor',
        'MINECRAFT_LAKE_NOISE_SCALE',
        'MINECRAFT_LAKE_WORLD_OFFSET',
        'MINECRAFT_LAKE_THRESHOLD',
        'MINECRAFT_LAKE_MAX_DEPTH',
        'MINECRAFT_LAKE_SHORE_WIDTH',
        'MINECRAFT_RIVER_WATER_LEVEL',
        'MINECRAFT_RIVER_MIN_CUT',
        'MINECRAFT_RIVER_MAX_CUT',
        'MINECRAFT_ICE_FREEZE_TEMPERATURE',
        'minecraftComputeLakeBasin',
        'minecraftResolveSurfaceY',
        'minecraftDetermineWaterLevel',
        'minecraftShouldFreezeWaterSurface',
        'minecraftIsLakeShoreColumn',
        'resolveMinecraftSurfaceMaterial',
        'minecraftTerrainColumnAt',
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
        'oldBlendedNoise',
        'beardifier',
        'lerp',
        'DensityMappedType',
        'map',
        'mappedNoise',
        'rangeChoice',
        'shiftedNoise2d',
        'createDensitySpline',
        'spline',
        'findTopSurface',
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
        'createNoiseField',
      ]
      const actual = new Set(Object.keys(noise))
      for (const name of expected) {
        expect(actual.has(name)).toBe(true)
      }
    }),
  )

  effectTest('supports official DensityFunctions factory names', () =>
    Effect.sync(() => {
      const source = noise.createDensityNoiseSource(
        () => 0.25,
        { minValue: -1, maxValue: 1 },
      )
      const input = noise.constant(0.5)
      const oldBlendedSource = noise.createDensityOldBlendedNoiseSource(
        {
          mainNoise: () => ({ sample: () => 0.25 }),
          minLimitNoise: () => ({ sample: () => 0.5 }),
          maxLimitNoise: () => ({ sample: () => 0.75 }),
        },
        { minValue: -1, maxValue: 1 },
      )

      expect(noise.zero().kind).toBe('constant')
      expect(noise.constant(1).kind).toBe('constant')
      expect(noise.noise(source).kind).toBe('noise')
      expect(noise.noise(source, 2).kind).toBe('noise')
      expect(noise.noise(source, 2, 3).kind).toBe('noise')
      expect(
        noise.densityOldBlendedNoise(oldBlendedSource, {
          smearScaleMultiplier: 4,
          xzFactor: 80,
          xzScale: 0.25,
          yFactor: 160,
          yScale: 0.25,
        }).kind,
      ).toBe('old-blended-noise')
      expect(
        noise.oldBlendedNoise(oldBlendedSource, {
          smearScaleMultiplier: 4,
          xzFactor: 80,
          xzScale: 0.25,
          yFactor: 160,
          yScale: 0.25,
        }).kind,
      ).toBe('old-blended-noise')
      expect(noise.densityBeardifier().kind).toBe('beardifier')
      expect(noise.beardifier().kind).toBe('beardifier')
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
        noise.findTopSurface(input, noise.constant(16), -32, 4).kind,
      ).toBe('find-top-surface')
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

describe('the canonical seed -> value contract', () => {
  // Golden values make intentional terrain changes visible in review. Update
  // them only together with the versioning and migration decision.
  const field = noise.createNoiseField(noise.NoiseSeed(20260726))

  effectTest('reproduces its golden samples exactly', () =>
    Effect.sync(() => {
      expect(field.raw2d(0.3, 0.7)).toMatchInlineSnapshot(`0.5950953166509184`)
      expect(field.raw2d(12.37, -7.13)).toMatchInlineSnapshot(`0.15995536869657265`)
      expect(field.noise2d(3.11, 9.87)).toMatchInlineSnapshot(`0.48198515258266483`)
      expect(field.raw3d(1.3, 2.7, -3.1)).toMatchInlineSnapshot(`-0.06349056477267119`)
      expect(field.octave2d(4.3, -6.9)).toMatchInlineSnapshot(`0.5687633107783282`)
      expect(field.channel('continentalness')(100.37, 200.13)).toMatchInlineSnapshot(`-0.1334556553219605`)
      expect(field.channel('erosion')(100.37, 200.13)).toMatchInlineSnapshot(`0.0028109265851947052`)
      expect(field.channel('weirdness')(100.37, 200.13)).toMatchInlineSnapshot(`0.2952584208943152`)
      expect(field.channel('jaggedness')(100.37, 200.13)).toMatchInlineSnapshot(`0.39266586686049454`)
    }),
  )

  effectTest('is exactly 0 at every lattice point, which is what gradient noise means', () =>
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

  effectTest('keeps half-integer samples varied with the canonical gradient set', () =>
    Effect.sync(() => {
      const halfIntegerSamples = Array.from({ length: 64 }, (_unused, index) =>
        field.raw2d(index + 0.5, index * 2 + 0.5),
      )
      const zeros = halfIntegerSamples.filter((value) => value === 0).length
      expect(zeros).toBeLessThan(10)
      expect(new Set(halfIntegerSamples).size).toBeGreaterThan(20)
    }),
  )

  effectTest('pins the channel salts, because changing one re-rolls that channel for every world', () =>
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
