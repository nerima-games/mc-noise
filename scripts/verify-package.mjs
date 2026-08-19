import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'mc-noise-package-'))
const COMMAND_TIMEOUT_MS = 60_000

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: COMMAND_TIMEOUT_MS,
  })
  if (result.error !== undefined || result.status !== 0) {
    const reason = result.error?.message ?? (result.stderr?.trim() || `exit status ${String(result.status)}`)
    throw new Error(`${command} ${args.join(' ')} failed: ${reason}`)
  }
  return result.stdout
}

try {
  const runtime = await import(pathToFileURL(join(root, 'dist/index.js')).href)
  if (typeof runtime.sampleNoise2DChunk !== 'function') {
    throw new Error('dist/index.js does not expose sampleNoise2DChunk')
  }
  if (typeof runtime.sampleNoise3DGrid !== 'function' || typeof runtime.sampleNoise3DInterpolatedGrid !== 'function') {
    throw new Error('dist/index.js does not expose the 3D sampling API')
  }
  if (typeof runtime.createSpline !== 'function' || typeof runtime.evaluateSpline !== 'function') {
    throw new Error('dist/index.js does not expose the spline API')
  }
  if (typeof runtime.createSimplexNoise2D !== 'function' || typeof runtime.createSimplexNoise3D !== 'function') {
    throw new Error('dist/index.js does not expose the Simplex API')
  }
  if (typeof runtime.densityConstant !== 'function' || typeof runtime.densityShiftA !== 'function' || typeof runtime.densityShiftB !== 'function' || typeof runtime.densityMappedNoise !== 'function' || typeof runtime.evaluateDensityFunction !== 'function') {
    throw new Error('dist/index.js does not expose the DensityFunction API')
  }
  if (typeof runtime.zero !== 'function' || typeof runtime.map !== 'function' || typeof runtime.mappedNoise !== 'function' || typeof runtime.shiftedNoise2d !== 'function' || typeof runtime.spline !== 'function') {
    throw new Error('dist/index.js does not expose the official DensityFunctions factories')
  }
  if (runtime.DensityMappedType?.ABS !== 'ABS' || runtime.DensityMappedType?.SQUEEZE !== 'SQUEEZE') {
    throw new Error('dist/index.js does not expose the official DensityFunctions mapped types')
  }
  if (typeof runtime.computeDensityFunction !== 'function' || typeof runtime.fillDensityFunctionArray !== 'function' || typeof runtime.mapAllDensityFunction !== 'function' || typeof runtime.createDensityFunctionRuntime !== 'function') {
    throw new Error('dist/index.js does not expose the DensityFunction runtime API')
  }
  if (typeof runtime.createNoiseRouter !== 'function' || typeof runtime.createNoiseRouterRuntime !== 'function' || typeof runtime.evaluateNoiseRouter !== 'function') {
    throw new Error('dist/index.js does not expose the NoiseRouter API')
  }
  if (typeof runtime.empty !== 'function' || typeof runtime.createClimateSamplerRuntime !== 'function' || typeof runtime.sampleClimateAt !== 'function') {
    throw new Error('dist/index.js does not expose the Climate sampler API')
  }
  if (typeof runtime.createBlender !== 'function' || typeof runtime.createDensityEvaluationContextFromBlender !== 'function') {
    throw new Error('dist/index.js does not expose the Blender API')
  }
  const sample = runtime.sampleNoise3DGrid((x, y, z) => x + y + z, {
    depth: 1,
    height: 1,
    width: 1,
  })
  if (!(sample instanceof Float32Array) || sample[0] !== 0) {
    throw new Error('dist/index.js 3D sampling API returned an invalid sample')
  }
  const spline = runtime.createSpline([
    [0, 0],
    [1, 1],
  ])
  if (runtime.evaluateSpline(spline, 0.25) !== 0.25) {
    throw new Error('dist/index.js spline API returned an invalid interpolation')
  }
  const simplex = runtime.createSimplexNoise2D(runtime.mulberry32(runtime.NoiseSeed(1)))
  if (!Number.isFinite(simplex(0.25, -0.5))) {
    throw new Error('dist/index.js Simplex API returned an invalid sample')
  }
  const density = runtime.densityConstant(3)
  if (runtime.evaluateDensityFunction(density, { x: 0, y: 0, z: 0 }) !== 3) {
    throw new Error('dist/index.js DensityFunction API returned an invalid sample')
  }
  const shiftSource = {
    maxValue: 10,
    minValue: -10,
    sample: (x, y, z) => x + y + z,
  }
  const shiftA = runtime.densityShiftA(shiftSource)
  const shiftB = runtime.densityShiftB(shiftSource)
  const mappedNoise = runtime.densityMappedNoise(shiftSource, -2, 6)
  const shiftPosition = { x: 2, y: 4, z: -3 }
  if (runtime.evaluateDensityFunction(shiftA, shiftPosition) !== -1 || runtime.evaluateDensityFunction(shiftB, shiftPosition) !== -1) {
    throw new Error('dist/index.js ShiftA/ShiftB returned an invalid sample')
  }
  if (runtime.evaluateDensityFunction(mappedNoise, shiftPosition) !== 14) {
    throw new Error('dist/index.js mappedNoise returned an invalid sample')
  }
  const officialDensity = runtime.map(runtime.densityConstant(-2), runtime.DensityMappedType.ABS)
  const densityRuntime = runtime.createDensityFunctionRuntime(officialDensity)
  if (densityRuntime.compute({ x: 0, y: 0, z: 0 }) !== 2 || densityRuntime.minValue !== 2 || densityRuntime.maxValue !== 2) {
    throw new Error('dist/index.js DensityFunction runtime returned an invalid result')
  }
  const densityNode = runtime.createDensityFunctionNode(officialDensity)
  if (densityNode.compute({ x: 0, y: 0, z: 0 }) !== 2 || densityNode.minValue() !== 2 || densityNode.maxValue() !== 2) {
    throw new Error('dist/index.js DensityFunction node returned an invalid result')
  }
  const densityValues = []
  runtime.fillDensityFunctionArray(officialDensity, densityValues, () => ({ x: 0, y: 0, z: 0 }))
  if (densityValues.length !== 0) {
    throw new Error('dist/index.js DensityFunction fillArray changed an empty target')
  }
  const router = runtime.createNoiseRouter(Object.fromEntries(runtime.NOISE_ROUTER_CHANNELS.map((channel) => [channel, runtime.densityConstant(1)])))
  const routerRuntime = runtime.createNoiseRouterRuntime(router)
  if (routerRuntime.mapAll((densityValue) => densityValue).finalDensity.minValue !== 1) {
    throw new Error('dist/index.js NoiseRouter runtime returned an invalid result')
  }
  if (runtime.evaluateNoiseRouter(router, { x: 0, y: 0, z: 0 }).temperature !== 1) {
    throw new Error('dist/index.js NoiseRouter evaluation returned an invalid result')
  }
  const climateRuntime = runtime.createClimateSamplerRuntime(runtime.empty())
  if (climateRuntime.sample(0, 0, 0).temperature !== 0 || climateRuntime.findSpawnPosition() !== undefined) {
    throw new Error('dist/index.js Climate sampler runtime returned an invalid result')
  }
  const blenderContext = runtime.createDensityEvaluationContextFromBlender(runtime.createBlender())
  if (runtime.evaluateDensityFunction(runtime.densityConstant(4), { x: 0, y: 0, z: 0 }, blenderContext) !== 4) {
    throw new Error('dist/index.js Blender context returned an invalid result')
  }

  run('pnpm', ['pack', '--pack-destination', temporaryDirectory, '--silent'])
  const archiveName = readdirSync(temporaryDirectory).find((name) => name.endsWith('.tgz'))
  if (archiveName === undefined) {
    throw new Error('pnpm pack produced no archive')
  }

  const archive = join(temporaryDirectory, archiveName)
  const entries = new Set(run('tar', ['-tzf', archive]).split('\n').filter(Boolean))
  for (const entry of [
    'package/dist/index.js',
    'package/dist/index.d.ts',
    'package/dist/domain/chunk-sampling.js',
    'package/dist/domain/chunk-sampling.d.ts',
    'package/dist/domain/sampling-3d.js',
    'package/dist/domain/sampling-3d-interpolation.js',
    'package/dist/domain/sampling-3d-grid.js',
    'package/dist/domain/spline.js',
    'package/dist/domain/spline.d.ts',
    'package/dist/domain/simplex.js',
    'package/dist/domain/simplex.d.ts',
    'package/dist/domain/density-function.js',
    'package/dist/domain/density-function.d.ts',
    'package/dist/domain/density-function-runtime.js',
    'package/dist/domain/density-function-runtime.d.ts',
    'package/dist/domain/density-function-node.js',
    'package/dist/domain/density-function-node.d.ts',
    'package/dist/domain/noise-router.js',
    'package/dist/domain/noise-router.d.ts',
    'package/dist/domain/climate.js',
    'package/dist/domain/climate.d.ts',
    'package/dist/domain/blender.js',
    'package/dist/domain/blender.d.ts',
  ]) {
    if (!entries.has(entry)) {
      throw new Error(`package archive is missing ${entry}`)
    }
  }
  if ([...entries].some((entry) => entry.startsWith('package/src/'))) {
    throw new Error('package archive contains source files')
  }
  console.log(`verified ${packageJson.name} archive ${archiveName}`)
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true })
}
