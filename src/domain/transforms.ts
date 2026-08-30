const PEAKS_AND_VALLEYS_BASE = 1
const PEAKS_AND_VALLEYS_SCALE = 3
const PEAKS_AND_VALLEYS_OFFSET = 2

export const peaksAndValleysFromWeirdness = (weirdness: number): number =>
  PEAKS_AND_VALLEYS_BASE -
  Math.abs(PEAKS_AND_VALLEYS_SCALE * Math.abs(weirdness) - PEAKS_AND_VALLEYS_OFFSET)
