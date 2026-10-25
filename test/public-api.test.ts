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
import { Effect, Result } from 'effect'
import { BlockAxis, PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import * as noise from '../src/index'

const requireSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value =>
  Result.getOrThrow(result)

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
      const source = requireSuccess(noise.createDensityNoiseSource(
        () => 0.25,
        { minValue: noise.DensityBound(-1), maxValue: noise.DensityBound(1) },
      ))
      const input = requireSuccess(noise.constant(noise.DensityValue(0.5)))
      const oldBlendedSource = requireSuccess(noise.createDensityOldBlendedNoiseSource(
        {
          mainNoise: () => ({ sample: () => noise.DensityValue(0.25) }),
          minLimitNoise: () => ({ sample: () => noise.DensityValue(0.5) }),
          maxLimitNoise: () => ({ sample: () => noise.DensityValue(0.75) }),
        },
        { minValue: noise.DensityBound(-1), maxValue: noise.DensityBound(1) },
      ))
      const unit = noise.DensityValue(1)

      expect(noise.zero().kind).toBe('constant')
      expect(requireSuccess(noise.constant(unit)).kind).toBe('constant')
      expect(requireSuccess(noise.noise(source)).kind).toBe('noise')
      expect(requireSuccess(noise.noise(source, noise.DensityScale(2))).kind).toBe('noise')
      expect(requireSuccess(noise.noise(source, noise.DensityScale(2), noise.DensityScale(3))).kind).toBe('noise')
      expect(
        requireSuccess(noise.densityOldBlendedNoise(oldBlendedSource, {
          smearScaleMultiplier: noise.DensityScale(4),
          xzFactor: noise.DensityScale(80),
          xzScale: noise.DensityScale(0.25),
          yFactor: noise.DensityScale(160),
          yScale: noise.DensityScale(0.25),
        })).kind,
      ).toBe('old-blended-noise')
      expect(
        requireSuccess(noise.oldBlendedNoise(oldBlendedSource, {
          smearScaleMultiplier: noise.DensityScale(4),
          xzFactor: noise.DensityScale(80),
          xzScale: noise.DensityScale(0.25),
          yFactor: noise.DensityScale(160),
          yScale: noise.DensityScale(0.25),
        })).kind,
      ).toBe('old-blended-noise')
      expect(noise.densityBeardifier().kind).toBe('beardifier')
      expect(noise.beardifier().kind).toBe('beardifier')
      expect(requireSuccess(noise.shift(source)).kind).toBe('shift')
      expect(requireSuccess(noise.shiftA(source)).kind).toBe('shift-a')
      expect(requireSuccess(noise.shiftB(source)).kind).toBe('shift-b')
      expect(requireSuccess(noise.add(input, input)).kind).toBe('binary')
      expect(requireSuccess(noise.mul(input, input)).kind).toBe('binary')
      expect(requireSuccess(noise.min(input, input)).kind).toBe('binary')
      expect(requireSuccess(noise.max(input, input)).kind).toBe('binary')
      expect(
        requireSuccess(noise.weirdScaledSampler(input, source, 'type-1')).kind,
      ).toBe('weird-scaled-sampler')
      expect(requireSuccess(noise.endIslands(0n)).kind).toBe('end-islands')
      expect(requireSuccess(noise.lerp(input, noise.DensityValue(0), input)).kind).toBe('binary')
      expect(requireSuccess(noise.map(input, noise.DensityMappedType.ABS)).kind).toBe('unary')
      expect(
        requireSuccess(noise.map(input, noise.DensityMappedType.SQUARE)).kind,
      ).toBe('unary')
      expect(Result.isFailure(noise.map(input, 'unsupported' as never))).toBe(true)
      expect(requireSuccess(noise.mappedNoise(source, BlockAxis(-1), BlockAxis(1))).kind).toBe('binary')
      expect(
        requireSuccess(noise.rangeChoice(
          input,
          noise.DensityValue(-1),
          noise.DensityValue(1),
          input,
          noise.zero(),
        )).kind,
      ).toBe('range-choice')
      expect(
        requireSuccess(noise.findTopSurface(
          input,
          requireSuccess(noise.constant(noise.DensityValue(16))),
          BlockAxis(-32),
          noise.DensityCellSize(4),
        )).kind,
      ).toBe('find-top-surface')
      expect(
        requireSuccess(noise.shiftedNoise2d(
          noise.zero(),
          noise.zero(),
          noise.DensityScale(1),
          source,
        )).kind,
      ).toBe('shifted-noise')
      const spline = requireSuccess(noise.createDensitySpline(
        noise.zero(),
        requireSuccess(noise.createSpline([])),
      ))
      expect(requireSuccess(noise.spline(spline)).kind).toBe('spline')
      expect(requireSuccess(noise.yClampedGradient(
        BlockAxis(0),
        BlockAxis(1),
        noise.DensityValue(0),
        noise.DensityValue(1),
      )).kind).toBe(
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
      expect(requireSuccess(field.octave2d(PositionAxis(4.3), PositionAxis(-6.9)))).toMatchInlineSnapshot(`0.5687633107783282`)
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
