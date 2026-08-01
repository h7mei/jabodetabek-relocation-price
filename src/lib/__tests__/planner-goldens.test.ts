import { describe, expect, it } from "vitest"

import { monthlyFromOneWay } from "@/lib/commute"
import { applyPeakMinutes, appliesPeak, p80FromP50 } from "@/lib/traffic"
import { canWalkAccess, canOjekAccess } from "@/lib/transitPlanner"
import { WALK_UNLOCK_M, OJEK_FEEDER_M } from "@/master/defaults"

describe("G1 monthly cost", () => {
  it("oneWayCost × 2 × WFO × 4.33", () => {
    const { monthlyCostIdr, dailyRtCostIdr } = monthlyFromOneWay(10_000, 40, 3)
    expect(dailyRtCostIdr).toBe(20_000)
    expect(monthlyCostIdr).toBe(Math.round(20_000 * 3 * 4.33))
  })
})

describe("G2 peak factor", () => {
  it("applies to gojek/motorcycle/car/TJ only", () => {
    expect(appliesPeak("gojek")).toBe(true)
    expect(appliesPeak("transjakarta")).toBe(true)
    expect(appliesPeak("krl")).toBe(false)
    expect(appliesPeak("walk")).toBe(false)
    expect(applyPeakMinutes("gojek", 100)).toBeCloseTo(145)
    expect(applyPeakMinutes("walk", 100)).toBe(100)
  })
})

describe("G3 P80", () => {
  it("≈ P50 × 1.4", () => {
    expect(p80FromP50(50)).toBeCloseTo(70)
  })
})

describe("G4/G5 access radii", () => {
  it("walk ≤ 1.2 km; ojek ≤ 8 km", () => {
    expect(canWalkAccess(WALK_UNLOCK_M)).toBe(true)
    expect(canWalkAccess(WALK_UNLOCK_M + 1)).toBe(false)
    expect(canOjekAccess(OJEK_FEEDER_M)).toBe(true)
    expect(canOjekAccess(OJEK_FEEDER_M + 1)).toBe(false)
  })
})
