import { requireFinite, requirePositiveFinite, requirePositiveInteger } from './number-validation.js'

const DEFAULT_GRID_ORIGIN = 0
const DEFAULT_GRID_STEP = 1

export const GRID_LOOP_STEP = 1

export type NoiseGrid3DOptions = Readonly<{
  readonly width: number
  readonly height: number
  readonly depth: number
  readonly originX?: number
  readonly originY?: number
  readonly originZ?: number
  readonly stepX?: number
  readonly stepY?: number
  readonly stepZ?: number
}>

export type NormalizedNoiseGrid3DOptions = Readonly<{
  readonly width: number
  readonly height: number
  readonly depth: number
  readonly originX: number
  readonly originY: number
  readonly originZ: number
  readonly stepX: number
  readonly stepY: number
  readonly stepZ: number
}>

export const normalizeNoiseGrid3DOptions = (options: NoiseGrid3DOptions): NormalizedNoiseGrid3DOptions => ({
  depth: requirePositiveInteger('depth', options.depth),
  height: requirePositiveInteger('height', options.height),
  originX: requireFinite('originX', options.originX ?? DEFAULT_GRID_ORIGIN),
  originY: requireFinite('originY', options.originY ?? DEFAULT_GRID_ORIGIN),
  originZ: requireFinite('originZ', options.originZ ?? DEFAULT_GRID_ORIGIN),
  stepX: requirePositiveFinite('stepX', options.stepX ?? DEFAULT_GRID_STEP),
  stepY: requirePositiveFinite('stepY', options.stepY ?? DEFAULT_GRID_STEP),
  stepZ: requirePositiveFinite('stepZ', options.stepZ ?? DEFAULT_GRID_STEP),
  width: requirePositiveInteger('width', options.width),
})
