import type {
  DensityEvaluationContext,
  DensityEvaluationContextOptions,
  DensityPosition,
} from './density-function-types.js'
import {
  createDensityEvaluationContext,
  requireDensityEvaluationContext,
} from './density-function-context.js'
import type { Position } from '@nerima-games/mc-kernel'
import { requireFiniteNumber } from './number-validation.js'

export type BlendingOutput = Readonly<{
  readonly alpha: number
  readonly blendingOffset: number
}>

export type BlenderBlendDensity = (
  position: DensityPosition,
  density: number,
) => number

export type BlenderBlendOffsetAndFactor = (
  x: number,
  z: number,
) => BlendingOutput

export type Blender = Readonly<{
  readonly blendDensity: BlenderBlendDensity
  readonly blendOffsetAndFactor: BlenderBlendOffsetAndFactor
}>

export type BlenderOptions = Readonly<{
  readonly blendDensity?: BlenderBlendDensity
  readonly blendOffsetAndFactor?: BlenderBlendOffsetAndFactor
}>

const identityBlendDensity: BlenderBlendDensity = (_position, density) =>
  density

const identityBlendOffsetAndFactor: BlenderBlendOffsetAndFactor = () =>
  Object.freeze({
    alpha: 1,
    blendingOffset: 0,
  })

const readNumber = (name: string, value: unknown): number => {
  if (typeof value !== 'number') {
    throw new TypeError(`${name} must be a number`)
  }
  return requireFiniteNumber(name, value)
}

const readPosition = (position: DensityPosition): Position => ({
  x: readNumber('position.x', position.x),
  y: readNumber('position.y', position.y),
  z: readNumber('position.z', position.z),
})

const readBlendingOutput = (value: unknown): BlendingOutput => {
  if (value === null || typeof value !== 'object') {
    throw new TypeError('blending output must be an object')
  }
  const output = value as {
    readonly alpha?: unknown
    readonly blendingOffset?: unknown
  }
  return Object.freeze({
    alpha: readNumber('blending output alpha', output.alpha),
    blendingOffset: readNumber(
      'blending output offset',
      output.blendingOffset,
    ),
  })
}

export const createBlender = (options: BlenderOptions = {}): Blender => {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object')
  }
  const blendDensity = options.blendDensity ?? identityBlendDensity
  const blendOffsetAndFactor =
    options.blendOffsetAndFactor ?? identityBlendOffsetAndFactor
  if (typeof blendDensity !== 'function') {
    throw new TypeError('blendDensity must be a function')
  }
  if (typeof blendOffsetAndFactor !== 'function') {
    throw new TypeError('blendOffsetAndFactor must be a function')
  }
  return Object.freeze({
    blendDensity: (position, density) => {
      const value = blendDensity(
        readPosition(position),
        readNumber('density', density),
      )
      return readNumber('blended density', value)
    },
    blendOffsetAndFactor: (x, z) =>
      readBlendingOutput(
        blendOffsetAndFactor(readNumber('x', x), readNumber('z', z)),
      ),
  })
}

export const emptyBlender = (): Blender => createBlender()

export const requireBlender = (value: unknown): Blender => {
  if (value === null || typeof value !== 'object') {
    throw new TypeError('blender must be an object')
  }
  const candidate = value as Partial<Blender>
  if (
    typeof candidate.blendDensity !== 'function' ||
    typeof candidate.blendOffsetAndFactor !== 'function'
  ) {
    throw new TypeError('blender must provide blend functions')
  }
  return candidate as Blender
}

export const createDensityEvaluationContextFromBlender = (
  blender: Blender = emptyBlender(),
  options: DensityEvaluationContextOptions = {},
): DensityEvaluationContext => {
  const normalizedBlender = requireBlender(blender)
  const context = createDensityEvaluationContext({
    ...options,
    blendAlpha: (position) =>
      normalizedBlender.blendOffsetAndFactor(position.x, position.z).alpha,
    blendDensity: (inputValue, position) =>
      normalizedBlender.blendDensity(position, inputValue),
    blendOffset: (position) =>
      normalizedBlender.blendOffsetAndFactor(position.x, position.z)
        .blendingOffset,
  })
  return requireDensityEvaluationContext(context)
}
