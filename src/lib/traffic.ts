import { PEAK_FACTOR, P80_FACTOR } from "@/master/defaults"
import type { LegKind } from "@/types"

/** Peak on road / TJ / Gojek; not on rail or walk */
export function appliesPeak(kind: LegKind): boolean {
  return (
    kind === "gojek" ||
    kind === "motorcycle" ||
    kind === "car" ||
    kind === "transjakarta"
  )
}

export function applyPeakMinutes(
  kind: LegKind,
  minutes: number,
  peakFactor = PEAK_FACTOR
): number {
  return appliesPeak(kind) ? minutes * peakFactor : minutes
}

export function p80FromP50(p50: number, p80Factor = P80_FACTOR): number {
  return p50 * p80Factor
}
