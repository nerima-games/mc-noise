export type SimplexPoint2D = Readonly<{
  readonly x: number
  readonly z: number
}>

export type SimplexPoint3D = Readonly<{
  readonly x: number
  readonly y: number
  readonly z: number
}>

export type SimplexOffset2D = Readonly<{
  readonly first: SimplexPoint2D
  readonly second: SimplexPoint2D
}>

export type SimplexOffset3D = Readonly<{
  readonly first: SimplexPoint3D
  readonly second: SimplexPoint3D
}>

export type SimplexCell2D = Readonly<{
  readonly cell: SimplexPoint2D
  readonly local: SimplexPoint2D
}>

export type SimplexCell3D = Readonly<{
  readonly cell: SimplexPoint3D
  readonly local: SimplexPoint3D
}>

export type SimplexCorner2D = Readonly<{
  readonly lattice: SimplexPoint2D
  readonly local: SimplexPoint2D
}>

export type SimplexCorner3D = Readonly<{
  readonly lattice: SimplexPoint3D
  readonly local: SimplexPoint3D
}>

export type SimplexCorners2D = Readonly<{
  readonly base: SimplexCorner2D
  readonly first: SimplexCorner2D
  readonly second: SimplexCorner2D
}>

export type SimplexCorners3D = Readonly<{
  readonly base: SimplexCorner3D
  readonly first: SimplexCorner3D
  readonly second: SimplexCorner3D
  readonly third: SimplexCorner3D
}>
