const HALF = 0.5
const ONE = 1
const TWO = 2
const THREE = 3
const FOUR = 4
const QUARTER = 0.25
const THREE_QUARTERS = 0.75
const ONE_AND_HALF = 1.5
const TWENTY_FOUR = 24
const NEGATIVE_HALF = -HALF
const NEGATIVE_THREE_QUARTERS = -THREE_QUARTERS

export const DENSITY_ZERO = 0
/**
 * `typeof <local const>` annotations below, not `number`: several of these
 * constants are compared with `.length === DENSITY_TWO`-style discriminants
 * elsewhere in this package to narrow a union of fixed-length tuple types.
 * Widening any of them to `number` would silently defeat that narrowing
 * (TypeScript can only narrow a tuple union by a length check against a
 * literal number). `typeof` keeps the literal type without repeating the
 * numeral inline, which `no-magic-numbers` would otherwise flag.
 */
export const DENSITY_ONE: typeof ONE = ONE
export const DENSITY_TWO: typeof TWO = TWO
export const DENSITY_THREE: typeof THREE = THREE
export const DENSITY_FOUR: typeof FOUR = FOUR
export const DENSITY_TWENTY_FOUR: typeof TWENTY_FOUR = TWENTY_FOUR
export const DENSITY_NEGATIVE_ONE: number = -ONE
export const DENSITY_NEGATIVE_HALF: number = NEGATIVE_HALF
export const DENSITY_NEGATIVE_THREE_QUARTERS: number = NEGATIVE_THREE_QUARTERS
export const DENSITY_HALF: typeof HALF = HALF
export const DENSITY_QUARTER: typeof QUARTER = QUARTER
export const DENSITY_THREE_QUARTERS: typeof THREE_QUARTERS = THREE_QUARTERS
export const DENSITY_ONE_AND_HALF: typeof ONE_AND_HALF = ONE_AND_HALF
export const DENSITY_INFINITY: number = Infinity
export const DENSITY_NEGATIVE_INFINITY: number = -Infinity
export const DENSITY_DEFAULT_OFFSET: typeof DENSITY_ZERO = DENSITY_ZERO
export const DENSITY_DEFAULT_SCALE: typeof DENSITY_ONE = DENSITY_ONE
export const DENSITY_SHIFT_COORDINATE_SCALE: typeof DENSITY_QUARTER = DENSITY_QUARTER
export const DENSITY_SHIFT_OUTPUT_SCALE: typeof DENSITY_FOUR = DENSITY_FOUR
