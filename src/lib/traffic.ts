import { PEAK_FACTOR, P80_FACTOR } from "@/master/defaults"
import type { LegKind } from "@/types"

/** Peak ×1.45 on road / TJ / Gojek; not on rail or walk */
export function appliesPeak(kind: LegKind): boolean {
  return (
    kind === "gojek" ||
    kind === "motorcycle" ||
    kind === "car" ||
    kind === "transjakarta"
  )
}

export function applyPeakMinutes(kind: LegKind, minutes: number): number {
  return appliesPeak(kind) ? minutes * PEAK_FACTOR : minutes
}

export function p80FromP50(p50: number): number {
  return p50 * P80_FACTOR
}
