import { describe, expect, it } from "vitest"

import { monthlyFromOneWay } from "@/lib/commute"
import { rankRecommendations } from "@/lib/multimodalPlanner"
import { applyPeakMinutes, appliesPeak, p80FromP50 } from "@/lib/traffic"
import {
  canWalkAccess,
  canOjekAccess,
  findInterchanges,
  systemReachesOffice,
} from "@/lib/transitPlanner"
import {
  INTERCHANGE_M,
  OJEK_FEEDER_M,
  PRICE_BAND_IDR,
  WALK_UNLOCK_M,
} from "@/master/defaults"
import type { CommutePlan, TransitStop } from "@/types"

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
    expect(appliesPeak("motorcycle")).toBe(true)
    expect(appliesPeak("car")).toBe(true)
    expect(appliesPeak("transjakarta")).toBe(true)
    expect(appliesPeak("krl")).toBe(false)
    expect(appliesPeak("walk")).toBe(false)
    expect(applyPeakMinutes("gojek", 100)).toBeCloseTo(145)
    expect(applyPeakMinutes("gojek", 100, 1.6)).toBeCloseTo(160)
    expect(applyPeakMinutes("walk", 100)).toBe(100)
  })
})

describe("G3 P80", () => {
  it("≈ P50 × 1.4 (or custom factor)", () => {
    expect(p80FromP50(50)).toBeCloseTo(70)
    expect(p80FromP50(50, 1.5)).toBeCloseTo(75)
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

function stop(
  id: string,
  system: TransitStop["system"],
  lat: number,
  lng: number
): TransitStop {
  return { id, name: id, system, lat, lng }
}

/** Tiny synthetic fixtures near SCBD */
const OFFICE = { lat: -6.2275, lng: 106.8085 }

describe("G6 interchange", () => {
  it("pairs only when stops ≤ 600 m; inventing hubs forbidden", () => {
    const nearKrl = stop("krl-a", "krl", OFFICE.lat, OFFICE.lng)
    // ~400 m east
    const nearMrt = stop("mrt-a", "mrt", OFFICE.lat, OFFICE.lng + 0.0036)
    // ~2 km east — not a co-located hub
    const farMrt = stop("mrt-far", "mrt", OFFICE.lat, OFFICE.lng + 0.018)

    const ok = findInterchanges("krl", "mrt", [nearKrl, nearMrt], OFFICE)
    expect(ok.length).toBe(1)
    expect(ok[0].meters).toBeLessThanOrEqual(INTERCHANGE_M)

    const none = findInterchanges("krl", "mrt", [nearKrl, farMrt], OFFICE)
    expect(none).toEqual([])
  })
})

describe("G7 same-line preferred", () => {
  it("boarding system that reaches office → transfers not required", () => {
    const krlAtOffice = stop("krl-scbd", "krl", OFFICE.lat, OFFICE.lng)
    const stops = [krlAtOffice]
    expect(systemReachesOffice(OFFICE, stops, "krl")).toBe(true)
    // Gate used by enumerateTransfers: skip sysA when it already reaches
    expect(!systemReachesOffice(OFFICE, stops, "krl")).toBe(false)

    const remoteOnly = [
      stop("krl-bogor", "krl", OFFICE.lat - 0.35, OFFICE.lng), // ≫ 8 km
    ]
    expect(systemReachesOffice(OFFICE, remoteOnly, "krl")).toBe(false)
  })
})

function stubPlan(
  signature: string,
  oneWayCostIdr: number,
  oneWayMinutes: number
): CommutePlan {
  return {
    signature,
    label: signature,
    legs: [],
    oneWayCostIdr,
    oneWayMinutes,
    dailyRtCostIdr: oneWayCostIdr * 2,
    monthlyCostIdr: oneWayCostIdr * 2,
    monthlyHours: 1,
    p50Minutes: oneWayMinutes,
    p80Minutes: Math.round(oneWayMinutes * 1.4),
  }
}

describe("G8 best price band", () => {
  it("among plans within Rp 5,000 of cheapest, pick fastest", () => {
    const plans = [
      stubPlan("cheap-slow", 10_000, 90),
      stubPlan("near-cheap-fast", 10_000 + PRICE_BAND_IDR, 45),
      stubPlan("outside-band", 10_000 + PRICE_BAND_IDR + 1, 20),
      stubPlan("expensive-fast", 50_000, 15),
    ]
    const ranked = rankRecommendations(plans)
    const bestPrice = ranked.find((p) => p.label === "Best price")
    expect(bestPrice?.signature).toBe("near-cheap-fast")
  })
})

describe("G9 mix output", () => {
  it("returns up to 3 recommendations with distinct signatures when possible", () => {
    const plans = [
      stubPlan("cheap-slow", 10_000, 90),
      stubPlan("near-cheap", 14_000, 70), // Best price (fastest in Rp5k band)
      stubPlan("door-fast", 50_000, 25), // Best time
      stubPlan("mid-balance", 30_000, 40), // Best balance
    ]
    const ranked = rankRecommendations(plans)
    expect(ranked.length).toBe(3)
    const sigs = ranked.map((p) => p.signature)
    expect(new Set(sigs).size).toBe(3)
    expect(ranked.map((p) => p.label)).toEqual([
      "Best price",
      "Best time",
      "Best balance",
    ])
    expect(sigs).toEqual(["near-cheap", "door-fast", "mid-balance"])
  })
})
