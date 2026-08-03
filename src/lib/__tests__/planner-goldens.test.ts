import { describe, expect, it } from "vitest"

import { monthlyFromOneWay } from "@/lib/commute"
import { rankRecommendations, shortlist } from "@/lib/multimodalPlanner"
import { applyPeakMinutes, appliesPeak, p80FromP50 } from "@/lib/traffic"
import {
  canWalkAccess,
  canOjekAccess,
  findInterchanges,
  systemReachesOffice,
  systemWalkReachesOffice,
  boardCandidates,
} from "@/lib/transitPlanner"
import {
  BOARD_CANDIDATES,
  INTERCHANGE_M,
  OJEK_FEEDER_M,
  SHORTLIST_CAP,
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
  it("walk ≤ 500 m; ojek ≤ 8 km", () => {
    expect(WALK_UNLOCK_M).toBe(500)
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

describe("G13 nearest board stop", () => {
  it("boards only the nearest in-radius stop (not 2nd/3rd nearer-line options)", () => {
    expect(BOARD_CANDIDATES).toBe(1)
    const home = { lat: OFFICE.lat - 0.01, lng: OFFICE.lng }
    const near = stop("mrt-near", "mrt", home.lat + 0.001, home.lng)
    const mid = stop("mrt-mid", "mrt", home.lat + 0.004, home.lng)
    const far = stop("mrt-far", "mrt", home.lat + 0.008, home.lng)
    const boards = boardCandidates(home, [far, mid, near], "mrt")
    expect(boards).toHaveLength(1)
    expect(boards[0].id).toBe("mrt-near")
  })
})

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
  it("walk-reachable boarding system → transfers not required; Gojek-distance still allows A→B", () => {
    const krlAtOffice = stop("krl-scbd", "krl", OFFICE.lat, OFFICE.lng)
    expect(systemWalkReachesOffice(OFFICE, [krlAtOffice], "krl")).toBe(true)
    // Transfer gate skips sysA when walk-reachable
    expect(systemWalkReachesOffice(OFFICE, [krlAtOffice], "krl")).toBe(true)

    // ~2 km east — within ojek, not walk → transfer may be warranted
    const mrtFeeder = stop("mrt-hi", "mrt", OFFICE.lat, OFFICE.lng + 0.018)
    expect(systemReachesOffice(OFFICE, [mrtFeeder], "mrt")).toBe(true)
    expect(systemWalkReachesOffice(OFFICE, [mrtFeeder], "mrt")).toBe(false)

    const remoteOnly = [
      stop("krl-bogor", "krl", OFFICE.lat - 0.35, OFFICE.lng), // ≫ 8 km
    ]
    expect(systemReachesOffice(OFFICE, remoteOnly, "krl")).toBe(false)
    expect(systemWalkReachesOffice(OFFICE, remoteOnly, "krl")).toBe(false)
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

describe("G8 best price fare-first among rail", () => {
  it("among MRT mixes, prefers MRT→TJ over MRT+expensive Gojek; ignores cheaper TJ→KRL", () => {
    const mrtTj = stubPlan("mrt-tj", 30_179, 72)
    mrtTj.legs = [
      {
        kind: "mrt",
        label: "MRT",
        from: { lat: 0, lng: 0 },
        to: { lat: 1, lng: 1 },
        meters: 14_000,
        minutes: 40,
        costIdr: 17_000,
      },
      {
        kind: "walk",
        label: "xfer",
        from: { lat: 1, lng: 1 },
        to: { lat: 1.01, lng: 1.01 },
        meters: 50,
        minutes: 3,
        costIdr: 0,
      },
      {
        kind: "transjakarta",
        label: "TJ",
        from: { lat: 1.01, lng: 1.01 },
        to: { lat: 1.5, lng: 1.5 },
        meters: 5_000,
        minutes: 20,
        costIdr: 3_500,
      },
      {
        kind: "gojek",
        label: "short egress",
        from: { lat: 1.5, lng: 1.5 },
        to: { lat: 2, lng: 2 },
        meters: 600,
        minutes: 4,
        costIdr: 9_500,
      },
    ]
    const mrtGojek = stubPlan("mrt-gojek", 29_858, 51)
    mrtGojek.legs = [
      {
        kind: "mrt",
        label: "MRT",
        from: { lat: 0, lng: 0 },
        to: { lat: 1, lng: 1 },
        meters: 14_000,
        minutes: 40,
        costIdr: 17_000,
      },
      {
        kind: "gojek",
        label: "long egress",
        from: { lat: 1, lng: 1 },
        to: { lat: 2, lng: 2 },
        meters: 1_900,
        minutes: 11,
        costIdr: 12_858,
      },
    ]
    const tjKrl = stubPlan("tj-krl", 16_900, 90)
    tjKrl.legs = [
      {
        kind: "transjakarta",
        label: "TJ",
        from: { lat: 0, lng: 0 },
        to: { lat: 1, lng: 1 },
        meters: 15_000,
        minutes: 70,
        costIdr: 3_500,
      },
      {
        kind: "krl",
        label: "KRL",
        from: { lat: 1, lng: 1 },
        to: { lat: 1.2, lng: 1.2 },
        meters: 2_000,
        minutes: 10,
        costIdr: 4_000,
      },
    ]
    const gojekDoor = stubPlan("gojek:door", 57_000, 26)
    gojekDoor.legs = [
      {
        kind: "gojek",
        label: "Door-to-door Gojek",
        from: { lat: 0, lng: 0 },
        to: { lat: 2, lng: 2 },
        meters: 12_000,
        minutes: 26,
        costIdr: 57_000,
      },
    ]
    const ranked = rankRecommendations([mrtGojek, mrtTj, tjKrl, gojekDoor])
    expect(ranked.find((p) => p.label === "Best price")?.signature).toBe(
      "mrt-tj"
    )
    expect(ranked.find((p) => p.label === "Best time")?.signature).toBe(
      "gojek:door"
    )
  })
})

describe("G9 mix output", () => {
  it("returns up to 3 recommendations with distinct signatures when possible", () => {
    const mrt = stubPlan("mrt-value", 37_000, 47)
    mrt.legs = [
      {
        kind: "mrt",
        label: "MRT",
        from: { lat: 0, lng: 0 },
        to: { lat: 1, lng: 1 },
        meters: 14_000,
        minutes: 47,
        costIdr: 37_000,
      },
    ]
    const plans = [
      stubPlan("tj-cheap-slow", 3_500, 90),
      mrt,
      stubPlan("door-fast", 80_000, 25),
      stubPlan("mid-balance", 40_000, 50),
    ]
    const ranked = rankRecommendations(plans)
    expect(ranked.length).toBeGreaterThanOrEqual(2)
    expect(ranked.length).toBeLessThanOrEqual(3)
    const sigs = ranked.map((p) => p.signature)
    expect(new Set(sigs).size).toBe(sigs.length)
    expect(ranked[0].label).toBe("Best price")
    expect(ranked.map((p) => p.label)).toContain("Best time")
    expect(ranked.find((p) => p.label === "Best price")?.signature).toBe(
      "mrt-value"
    )
    expect(ranked.find((p) => p.label === "Best time")?.signature).toBe(
      "door-fast"
    )
  })
})

function stubDraft(signature: string, costIdr: number, minutes: number) {
  return {
    signature,
    label: signature,
    legs: [
      {
        kind: "walk" as const,
        label: signature,
        from: { lat: 0, lng: 0 },
        to: { lat: 0, lng: 0 },
        meters: 0,
        minutes,
        costIdr,
      },
    ],
  }
}

describe("G12 shortlist diversity", () => {
  it("caps at 28 and keeps fastest even when cheap variants flood", () => {
    const drafts = [
      // Many cheap slow TJ-like variants (would fill a greedy-by-cost shortlist)
      ...Array.from({ length: 40 }, (_, i) =>
        stubDraft(`tj-cheap-${i}`, 3_500, 80 + (i % 20))
      ),
      // Faster rail — must survive for Best time
      stubDraft("mrt-fast", 40_000, 47),
      stubDraft("gojek-door", 55_000, 51),
    ]
    const kept = shortlist(drafts)
    expect(kept.length).toBeLessThanOrEqual(SHORTLIST_CAP)
    expect(kept.some((p) => p.signature === "mrt-fast")).toBe(true)

    const asPlans = kept.map((d) => {
      const mins = d.legs.reduce((s, l) => s + l.minutes, 0)
      const cost = d.legs.reduce((s, l) => s + l.costIdr, 0)
      return stubPlan(d.signature, cost, mins)
    })
    const ranked = rankRecommendations(asPlans)
    const bestTime = ranked.find((p) => p.label === "Best time")
    expect(bestTime?.signature).toBe("mrt-fast")
  })
})
