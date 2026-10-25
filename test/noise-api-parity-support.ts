export const NOISE_API_PARITY_BASELINE = [
  '61a4a4d0600a1ce35c75',
  '1a4a4d0600a1ce35c751',
].join('')

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type NoiseApiParitySample = Readonly<{
  id: string
  family: 'noise' | 'climate' | 'density' | 'sampling'
  api: string
  input: JsonValue
  output: JsonValue
}>

type SampleDefinition = Omit<NoiseApiParitySample, 'output'> & Readonly<{
  evaluate: (api: object) => unknown
}>

const NOISE_SEED = 20_260_726
const VALUE_NOISE_SEED = 42
const SAMPLE_X = 12.25
const SAMPLE_Z = -9.5

const invoke = (target: object, name: string, arguments_: readonly unknown[] = []): unknown => {
  const member: unknown = Reflect.get(target, name)
  if (typeof member !== 'function') {
    throw new TypeError(`${name} must be an exported function`)
  }
  return Reflect.apply(member, target, [...arguments_])
}

const asObject = (value: unknown, name: string): object => {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${name} must return an object`)
  }
  return value
}

const unwrap = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') {
    return value
  }
  const tag: unknown = Reflect.get(value, '_tag')
  if (tag === 'Success') {
    const success = Reflect.get(value, 'success')
    if (typeof success === 'undefined') {
      return Reflect.get(value, 'value')
    }
    return success
  }
  if (tag === 'Failure') {
    throw Reflect.get(value, 'failure')
  }
  if (tag === 'Right') {
    return Reflect.get(value, 'right')
  }
  if (tag === 'Left') {
    throw Reflect.get(value, 'left')
  }
  return value
}

const normalize = (value: unknown): JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new RangeError('parity outputs must be finite numbers')
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map(normalize)
  }
  if (value instanceof Float32Array) {
    return Array.from(value, normalize)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    )
  }
  throw new TypeError(`parity output cannot serialize ${typeof value}`)
}

const defineSample = (
  definition: SampleDefinition,
  api: object,
): NoiseApiParitySample => {
  try {
    return {
      api: definition.api,
      family: definition.family,
      id: definition.id,
      input: definition.input,
      output: normalize(unwrap(definition.evaluate(api))),
    }
  } catch (error) {
    throw new Error(`${definition.id}: ${String(error)}`, { cause: error })
  }
}

const definitions: readonly SampleDefinition[] = [
  {
    api: 'createNoiseField().raw2d',
    evaluate: (api) => {
      const field = asObject(invoke(api, 'createNoiseField', [NOISE_SEED]), 'createNoiseField')
      return invoke(field, 'raw2d', [SAMPLE_X, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.field.raw2d',
    input: { seed: NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'createNoiseField().noise2d',
    evaluate: (api) => {
      const field = asObject(invoke(api, 'createNoiseField', [NOISE_SEED]), 'createNoiseField')
      return invoke(field, 'noise2d', [SAMPLE_X, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.field.noise2d',
    input: { seed: NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'createNoiseField().octave2d',
    evaluate: (api) => {
      const field = asObject(invoke(api, 'createNoiseField', [NOISE_SEED]), 'createNoiseField')
      return invoke(field, 'octave2d', [SAMPLE_X, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.field.octave2d',
    input: { seed: NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'createNoiseField().raw3d',
    evaluate: (api) => {
      const field = asObject(invoke(api, 'createNoiseField', [NOISE_SEED]), 'createNoiseField')
      return invoke(field, 'raw3d', [SAMPLE_X, 64.5, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.field.raw3d',
    input: { seed: NOISE_SEED, x: SAMPLE_X, y: 64.5, z: SAMPLE_Z },
  },
  {
    api: 'createNoiseField().noise3d',
    evaluate: (api) => {
      const field = asObject(invoke(api, 'createNoiseField', [NOISE_SEED]), 'createNoiseField')
      return invoke(field, 'noise3d', [SAMPLE_X, 64.5, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.field.noise3d',
    input: { seed: NOISE_SEED, x: SAMPLE_X, y: 64.5, z: SAMPLE_Z },
  },
  ...(['base2d', 'continentalness', 'erosion', 'weirdness'] as const).map((channel) => ({
    api: 'createNoiseField().channel()',
    evaluate: (api: object) => {
      const field = asObject(invoke(api, 'createNoiseField', [NOISE_SEED]), 'createNoiseField')
      const channelSampler = invoke(field, 'channel', [channel])
      if (typeof channelSampler !== 'function') {
        throw new TypeError('channel must return a sampler')
      }
      return Reflect.apply(channelSampler, globalThis.undefined, [SAMPLE_X, SAMPLE_Z])
    },
    family: 'noise' as const,
    id: `noise.field.channel.${channel}`,
    input: { channel, seed: NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  })),
  {
    api: 'mulberry32()',
    evaluate: (api) => {
      const random = invoke(api, 'mulberry32', [NOISE_SEED])
      if (typeof random !== 'function') {
        throw new TypeError('mulberry32 must return a random function')
      }
      return Array.from({ length: 8 }, () => Reflect.apply(random, globalThis.undefined, []))
    },
    family: 'noise',
    id: 'noise.mulberry32.first-eight',
    input: { count: 8, seed: NOISE_SEED },
  },
  {
    api: 'channelSeed()',
    evaluate: (api) => invoke(api, 'channelSeed', [NOISE_SEED, 'terrain-continentalness']),
    family: 'noise',
    id: 'noise.value.channelSeed',
    input: { channel: 'terrain-continentalness', seed: NOISE_SEED },
  },
  {
    api: 'latticeValue()',
    evaluate: (api) => invoke(api, 'latticeValue', [VALUE_NOISE_SEED, -7, 11]),
    family: 'noise',
    id: 'noise.value.latticeValue',
    input: { seed: VALUE_NOISE_SEED, x: -7, z: 11 },
  },
  {
    api: 'valueNoise2D()',
    evaluate: (api) => invoke(api, 'valueNoise2D', [VALUE_NOISE_SEED, SAMPLE_X, SAMPLE_Z, 0.125]),
    family: 'noise',
    id: 'noise.value.valueNoise2D',
    input: { frequency: 0.125, seed: VALUE_NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'fbm2D()',
    evaluate: (api) => invoke(api, 'fbm2D', [VALUE_NOISE_SEED, SAMPLE_X, SAMPLE_Z, {
      frequency: 0.125,
      octaves: 4,
      persistence: 0.5,
    }]),
    family: 'noise',
    id: 'noise.value.fbm2D',
    input: { frequency: 0.125, octaves: 4, persistence: 0.5, seed: VALUE_NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'createSimplexNoise2D()',
    evaluate: (api) => {
      const random = invoke(api, 'mulberry32', [NOISE_SEED])
      const sampler = unwrap(invoke(api, 'createSimplexNoise2D', [random, { originX: 0, originZ: 0 }]))
      if (typeof sampler !== 'function') {
        throw new TypeError('createSimplexNoise2D must return a sampler')
      }
      return Reflect.apply(sampler, globalThis.undefined, [SAMPLE_X, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.simplex.2d',
    input: { seed: NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'createSimplexNoise3D()',
    evaluate: (api) => {
      const random = invoke(api, 'mulberry32', [NOISE_SEED])
      const sampler = unwrap(invoke(api, 'createSimplexNoise3D', [random, { originX: 0, originY: 0, originZ: 0 }]))
      if (typeof sampler !== 'function') {
        throw new TypeError('createSimplexNoise3D must return a sampler')
      }
      return Reflect.apply(sampler, globalThis.undefined, [SAMPLE_X, 64.5, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.simplex.3d',
    input: { seed: NOISE_SEED, x: SAMPLE_X, y: 64.5, z: SAMPLE_Z },
  },
  {
    api: 'createNoisePrimitives().raw2D',
    evaluate: (api) => {
      const primitives = asObject(invoke(api, 'createNoisePrimitives', [NOISE_SEED]), 'createNoisePrimitives')
      return invoke(primitives, 'raw2D', [SAMPLE_X, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.primitives.raw2D',
    input: { seed: NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'createNoisePrimitives().noise2D',
    evaluate: (api) => {
      const primitives = asObject(invoke(api, 'createNoisePrimitives', [NOISE_SEED]), 'createNoisePrimitives')
      return invoke(primitives, 'noise2D', [SAMPLE_X, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.primitives.noise2D',
    input: { seed: NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'createNoisePrimitives().continentalnessAt',
    evaluate: (api) => {
      const primitives = asObject(invoke(api, 'createNoisePrimitives', [NOISE_SEED]), 'createNoisePrimitives')
      return invoke(primitives, 'continentalnessAt', [SAMPLE_X, SAMPLE_Z])
    },
    family: 'noise',
    id: 'noise.primitives.continentalnessAt',
    input: { seed: NOISE_SEED, x: SAMPLE_X, z: SAMPLE_Z },
  },
  {
    api: 'quantizeCoord()',
    evaluate: (api) => invoke(api, 'quantizeCoord', [0.1375]),
    family: 'climate',
    id: 'climate.quantizeCoord',
    input: { value: 0.1375 },
  },
  {
    api: 'unquantizeCoord()',
    evaluate: (api) => invoke(api, 'unquantizeCoord', [1375]),
    family: 'climate',
    id: 'climate.unquantizeCoord',
    input: { value: 1375 },
  },
  {
    api: 'climateParameter()',
    evaluate: (api) => invoke(api, 'climateParameter', [0.1375]),
    family: 'climate',
    id: 'climate.climateParameter',
    input: { value: 0.1375 },
  },
  {
    api: 'climateParameterRange()',
    evaluate: (api) => invoke(api, 'climateParameterRange', [-0.25, 0.5]),
    family: 'climate',
    id: 'climate.climateParameterRange',
    input: { max: 0.5, min: -0.25 },
  },
  {
    api: 'climateParameterDistance()',
    evaluate: (api) => {
      const parameter = unwrap(invoke(api, 'climateParameterRange', [-0.25, 0.5]))
      return invoke(api, 'climateParameterDistance', [parameter, 1250])
    },
    family: 'climate',
    id: 'climate.climateParameterDistance',
    input: { max: 0.5, min: -0.25, target: 1250 },
  },
  {
    api: 'sampleClimate()',
    evaluate: (api) => {
      const climateValues = [0.125, 0.25, -0.25, 0.375, -0.5, 0.75]
      const densities = climateValues.map((value) => unwrap(invoke(api, 'densityConstant', [value])))
      const sampler = unwrap(invoke(api, 'createClimateSampler', [{
        continentalness: densities[2],
        depth: densities[4],
        erosion: densities[3],
        humidity: densities[1],
        temperature: densities[0],
        weirdness: densities[5],
      }]))
      return invoke(api, 'sampleClimate', [sampler, { x: 17, y: 64, z: -29 }])
    },
    family: 'climate',
    id: 'climate.sampleClimate',
    input: {
      position: { x: 17, y: 64, z: -29 },
      values: { continentalness: -0.25, depth: -0.5, erosion: 0.375, humidity: 0.25, temperature: 0.125, weirdness: 0.75 },
    },
  },
  {
    api: 'densityNoise() + evaluateDensityFunction()',
    evaluate: (api) => {
      const source = unwrap(invoke(api, 'createDensityNoiseSource', [
        (x: number, y: number, z: number) => x + y + z,
        { minValue: -10, maxValue: 10 },
      ]))
      const density = unwrap(invoke(api, 'densityNoise', [source, { xzScale: 2, yScale: 3 }]))
      return invoke(api, 'evaluateDensityFunction', [density, { x: 2, y: 4, z: -3 }])
    },
    family: 'density',
    id: 'density.noise.evaluate',
    input: { bounds: { maxValue: 10, minValue: -10 }, noise: 'x + y + z', options: { xzScale: 2, yScale: 3 }, position: { x: 2, y: 4, z: -3 } },
  },
  {
    api: 'densityAdd() + evaluateDensityFunction()',
    evaluate: (api) => {
      const left = unwrap(invoke(api, 'densityConstant', [0.375]))
      const right = unwrap(invoke(api, 'densityConstant', [-0.125]))
      const density = unwrap(invoke(api, 'densityAdd', [left, right]))
      return invoke(api, 'evaluateDensityFunction', [density, { x: 17, y: 64, z: -29 }])
    },
    family: 'density',
    id: 'density.add.evaluate',
    input: { left: 0.375, position: { x: 17, y: 64, z: -29 }, right: -0.125 },
  },
  {
    api: 'densityEndIslands() + evaluateDensityFunction()',
    evaluate: (api) => {
      const density = unwrap(invoke(api, 'densityEndIslands', [42n]))
      return invoke(api, 'evaluateDensityFunction', [density, { x: 17, y: 64, z: -29 }])
    },
    family: 'density',
    id: 'density.end-islands.seed-42',
    input: { position: { x: 17, y: 64, z: -29 }, seed: '42' },
  },
  {
    api: 'densityBounds()',
    evaluate: (api) => {
      const density = unwrap(invoke(api, 'densityAdd', [
        unwrap(invoke(api, 'densityConstant', [-2.5])),
        unwrap(invoke(api, 'densityConstant', [3.25])),
      ]))
      return invoke(api, 'densityBounds', [density])
    },
    family: 'density',
    id: 'density.bounds.add',
    input: { left: -2.5, right: 3.25 },
  },
  {
    api: 'sampleNoise2DBatch()',
    evaluate: (api) => invoke(api, 'sampleNoise2DBatch', [
      (x: number, z: number) => x * 10 + z,
      [{ x: 1, z: 2 }, { x: -1, z: 3 }, { x: 0.5, z: -0.25 }],
    ]),
    family: 'sampling',
    id: 'sampling.2d.batch',
    input: { noise: 'x * 10 + z', points: [{ x: 1, z: 2 }, { x: -1, z: 3 }, { x: 0.5, z: -0.25 }] },
  },
  {
    api: 'sampleNoise2DGrid()',
    evaluate: (api) => invoke(api, 'sampleNoise2DGrid', [
      (x: number, z: number) => x * 10 + z,
      { depth: 2, originX: 2, originZ: -1, stepX: 0.5, stepZ: 2, width: 3 },
    ]),
    family: 'sampling',
    id: 'sampling.2d.grid',
    input: { noise: 'x * 10 + z', options: { depth: 2, originX: 2, originZ: -1, stepX: 0.5, stepZ: 2, width: 3 } },
  },
  {
    api: 'sampleNoise2DInterpolatedGrid()',
    evaluate: (api) => invoke(api, 'sampleNoise2DInterpolatedGrid', [
      (x: number, z: number) => x * 10 + z,
      { depth: 3, originX: 1, originZ: 2, sampleStride: 2, width: 4 },
    ]),
    family: 'sampling',
    id: 'sampling.2d.interpolated-grid',
    input: { noise: 'x * 10 + z', options: { depth: 3, originX: 1, originZ: 2, sampleStride: 2, width: 4 } },
  },
  {
    api: 'sampleNoise3DBatch()',
    evaluate: (api) => invoke(api, 'sampleNoise3DBatch', [
      (x: number, y: number, z: number) => x + y * 10 + z * 100,
      [{ x: 3, y: 2, z: 1 }, { x: -3, y: 2, z: 1 }],
    ]),
    family: 'sampling',
    id: 'sampling.3d.batch',
    input: { noise: 'x + y * 10 + z * 100', points: [{ x: 3, y: 2, z: 1 }, { x: -3, y: 2, z: 1 }] },
  },
  {
    api: 'sampleNoise3DGrid()',
    evaluate: (api) => invoke(api, 'sampleNoise3DGrid', [
      (x: number, y: number, z: number) => x + y * 10 + z * 100,
      { depth: 2, height: 2, originX: 1, originY: 2, originZ: 3, width: 2 },
    ]),
    family: 'sampling',
    id: 'sampling.3d.grid',
    input: { noise: 'x + y * 10 + z * 100', options: { depth: 2, height: 2, originX: 1, originY: 2, originZ: 3, width: 2 } },
  },
  {
    api: 'sampleNoise3DInterpolatedGrid()',
    evaluate: (api) => invoke(api, 'sampleNoise3DInterpolatedGrid', [
      (x: number, y: number, z: number) => x + y * 10 + z * 100,
      { depth: 2, height: 2, originX: 1, originY: 2, originZ: 3, sampleStrideX: 2, sampleStrideY: 2, sampleStrideZ: 2, width: 3 },
    ]),
    family: 'sampling',
    id: 'sampling.3d.interpolated-grid',
    input: { noise: 'x + y * 10 + z * 100', options: { depth: 2, height: 2, originX: 1, originY: 2, originZ: 3, sampleStrideX: 2, sampleStrideY: 2, sampleStrideZ: 2, width: 3 } },
  },
  {
    api: 'sampleNoise2DChunk()',
    evaluate: (api) => invoke(api, 'sampleNoise2DChunk', [
      (x: number, z: number) => x + z / 100,
      { cx: 2, cz: -3 },
    ]),
    family: 'sampling',
    id: 'sampling.2d.chunk.full',
    input: { chunk: { cx: 2, cz: -3 }, noise: 'x + z / 100' },
  },
  {
    api: 'sampleNoise2DChunk() sparse',
    evaluate: (api) => invoke(api, 'sampleNoise2DChunk', [
      (x: number, z: number) => x - z * 2,
      { cx: -1, cz: 1 },
      { sampleStride: 4 },
    ]),
    family: 'sampling',
    id: 'sampling.2d.chunk.stride-4',
    input: { chunk: { cx: -1, cz: 1 }, noise: 'x - z * 2', options: { sampleStride: 4 } },
  },
  {
    api: 'sampleNoise3DChunk()',
    evaluate: (api) => invoke(api, 'sampleNoise3DChunk', [
      (x: number, y: number, z: number) => x + y * 10 + z * 100,
      { cx: 1, cz: -1 },
      3,
      { originY: 5 },
    ]),
    family: 'sampling',
    id: 'sampling.3d.chunk.height-3',
    input: { chunk: { cx: 1, cz: -1 }, height: 3, noise: 'x + y * 10 + z * 100', options: { originY: 5 } },
  },
  {
    api: 'sampleNoise3DChunk() with non-unit spacing',
    evaluate: (api) => invoke(api, 'sampleNoise3DChunk', [
      (x: number, y: number, z: number) => x * 100 + y * 10 + z,
      { cx: -2, cz: 2 },
      2,
      { originY: -3, stepX: 2, stepY: 4, stepZ: 3 },
    ]),
    family: 'sampling',
    id: 'sampling.3d.chunk.spaced',
    input: { chunk: { cx: -2, cz: 2 }, height: 2, noise: 'x * 100 + y * 10 + z', options: { originY: -3, stepX: 2, stepY: 4, stepZ: 3 } },
  },
]

export const captureNoiseApiParitySamples = (api: object): readonly NoiseApiParitySample[] =>
  definitions.map((definition) => defineSample(definition, api))
