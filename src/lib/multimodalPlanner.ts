import { fareIdr, monthlyFromOneWay } from "@/lib/commute"
import {
  getDrivingRoute,
  haversineMeters,
  peakRoadMinutes,
  straightLineMinutes,
} from "@/lib/routing"
import { applyPeakMinutes, p80FromP50 } from "@/lib/traffic"
import { pathBetweenStops } from "@/lib/transitNetwork"
import {
  alightCandidates,
  boardCandidates,
  canOjekAccess,
  canWalkAccess,
  findInterchanges,
  systemReachesOffice,
  systemWalkReachesOffice,
  transitOnlyUnlocked,
} from "@/lib/transitPlanner"
import {
  OJEK_KMH,
  SHORTLIST_CAP,
  VOT_IDR_PER_MIN,
  VOT_TIE_BAND_IDR,
  WALK_M_PER_MIN,
} from "@/master/defaults"
import {
  TRANSIT_SYSTEMS,
  type CommuteMode,
  type CommutePlan,
  type LatLng,
  type LegKind,
  type LoadedTransitSystem,
  type Pin,
  type PlanLeg,
  type PricingMaster,
  type TrafficMaster,
  type TransitStop,
  type TransitSystem,
} from "@/types"

type AccessMode = "walk" | "gojek"

type DraftLeg = Omit<PlanLeg, "coordinates"> & {
  coordinates?: [number, number][]
  needsOsrm?: boolean
}

type DraftPlan = {
  signature: string
  label: string
  legs: DraftLeg[]
}

function walkMinutes(meters: number): number {
  return Math.max(3, meters / WALK_M_PER_MIN)
}

function accessLeg(
  kind: AccessMode,
  from: LatLng,
  to: LatLng,
  label: string,
  pricing: PricingMaster,
  traffic: TrafficMaster
): DraftLeg {
  const meters = haversineMeters(from, to)
  if (kind === "walk") {
    return {
      kind: "walk",
      label,
      from,
      to,
      meters,
      minutes: walkMinutes(meters),
      costIdr: 0,
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    }
  }
  const minutes = applyPeakMinutes(
    "gojek",
    straightLineMinutes(meters, OJEK_KMH),
    traffic.peakFactor
  )
  return {
    kind: "gojek",
    label,
    from,
    to,
    meters,
    minutes,
    costIdr: fareIdr(pricing.gojek, meters),
    needsOsrm: true,
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
  }
}

function accessOptions(
  stop: TransitStop & { meters: number },
  walkOnly: boolean
): AccessMode[] {
  const opts: AccessMode[] = []
  if (canWalkAccess(stop.meters)) opts.push("walk")
  if (!walkOnly && canOjekAccess(stop.meters)) opts.push("gojek")
  return opts
}

function networkBySystem(
  systems: LoadedTransitSystem[]
): Map<TransitSystem, LoadedTransitSystem> {
  return new Map(systems.map((s) => [s.id, s]))
}

function allStops(systems: LoadedTransitSystem[]): TransitStop[] {
  return systems.flatMap((s) => s.stops)
}

function rideLeg(
  system: TransitSystem,
  fromStop: TransitStop,
  toStop: TransitStop,
  network: GeoJSON.FeatureCollection,
  pricing: PricingMaster,
  traffic: TrafficMaster
): DraftLeg {
  const path = pathBetweenStops(system, network, fromStop, toStop)
  let minutes = path.minutes
  minutes = applyPeakMinutes(system, minutes, traffic.peakFactor)
  const band = pricing[system]
  return {
    kind: system,
    label: `${system.toUpperCase()} ${fromStop.name} → ${toStop.name}`,
    from: fromStop,
    to: toStop,
    meters: path.meters,
    minutes,
    costIdr: fareIdr(band, path.meters),
    coordinates: path.coordinates,
  }
}

function scoreDraft(plan: DraftPlan): { minutes: number; cost: number } {
  const minutes = plan.legs.reduce((s, l) => s + l.minutes, 0)
  const cost = plan.legs.reduce((s, l) => s + l.costIdr, 0)
  return { minutes, cost }
}

function finalizePlan(
  plan: DraftPlan,
  wfoDays: number,
  traffic: TrafficMaster
): CommutePlan {
  const { minutes, cost } = scoreDraft(plan)
  const monthly = monthlyFromOneWay(cost, minutes, wfoDays)
  const p50 = minutes
  return {
    signature: plan.signature,
    label: plan.label,
    legs: plan.legs.map(({ needsOsrm: _, ...leg }) => leg),
    oneWayMinutes: Math.round(minutes),
    oneWayCostIdr: cost,
    dailyRtCostIdr: monthly.dailyRtCostIdr,
    monthlyCostIdr: monthly.monthlyCostIdr,
    monthlyHours: Math.round(monthly.monthlyHours * 10) / 10,
    p50Minutes: Math.round(p50),
    p80Minutes: Math.round(p80FromP50(p50, traffic.p80Factor)),
  }
}

async function enrichGojekLegs(
  plan: DraftPlan,
  traffic: TrafficMaster
): Promise<DraftPlan> {
  const legs = await Promise.all(
    plan.legs.map(async (leg) => {
      if (leg.kind !== "gojek" || !leg.needsOsrm) return leg
      const route = await getDrivingRoute(leg.from, leg.to)
      return {
        ...leg,
        meters: route.meters,
        minutes: peakRoadMinutes(route.durationSec, traffic.peakFactor),
        coordinates: route.coordinates,
        needsOsrm: false,
      }
    })
  )
  // Recompute gojek fares with road meters
  const withFares = legs.map((leg) => {
    if (leg.kind !== "gojek") return leg
    return leg
  })
  return { ...plan, legs: withFares }
}

function draftFamily(plan: DraftPlan): string {
  const ride = plan.legs
    .map((l) => l.kind)
    .filter(
      (k) => k === "krl" || k === "mrt" || k === "lrt" || k === "transjakarta"
    )
  return ride.length ? ride.join("→") : plan.label
}

/**
 * Pre-OSRM shortlist: union of top cheap / fast / balanced drafts.
 * Exported for golden G12 — must not let one axis (e.g. many cheap TJ
 * variants) consume the full cap before faster rail plans are considered.
 */
export function shortlist(plans: DraftPlan[]): DraftPlan[] {
  const uniq = new Map<string, DraftPlan>()
  for (const p of plans) {
    if (!uniq.has(p.signature)) uniq.set(p.signature, p)
  }
  const list = [...uniq.values()]
  const scored = list.map((p) => ({ p, ...scoreDraft(p) }))
  const byCost = [...scored].sort(
    (a, b) => a.cost - b.cost || a.minutes - b.minutes
  )
  const byTime = [...scored].sort(
    (a, b) => a.minutes - b.minutes || a.cost - b.cost
  )
  const maxCost = Math.max(...scored.map((s) => s.cost), 1)
  const maxMins = Math.max(...scored.map((s) => s.minutes), 1)
  const byBal = [...scored].sort(
    (a, b) =>
      a.cost / maxCost +
      a.minutes / maxMins -
      (b.cost / maxCost + b.minutes / maxMins)
  )

  const quota = Math.ceil(SHORTLIST_CAP / 3)
  const picked = new Map<string, DraftPlan>()
  const familyCount = new Map<string, number>()
  const takeFrom = (
    arr: { p: DraftPlan; minutes: number; cost: number }[],
    limit: number,
    maxPerFamily: number
  ) => {
    let taken = 0
    for (const s of arr) {
      if (taken >= limit || picked.size >= SHORTLIST_CAP) break
      if (picked.has(s.p.signature)) continue
      const fam = draftFamily(s.p)
      const n = familyCount.get(fam) ?? 0
      if (n >= maxPerFamily) continue
      picked.set(s.p.signature, s.p)
      familyCount.set(fam, n + 1)
      taken++
    }
  }
  // Cap per ride-family so TJ floods cannot starve MRT→TJ transfers
  for (const arr of [byCost, byTime, byBal]) takeFrom(arr, quota, 2)
  for (const arr of [byTime, byCost, byBal]) takeFrom(arr, SHORTLIST_CAP, 4)

  return [...picked.values()].slice(0, SHORTLIST_CAP)
}

function isDoorToDoorGojek(plan: CommutePlan): boolean {
  return (
    plan.signature === "gojek:door" ||
    (plan.legs.length === 1 && plan.legs[0]?.kind === "gojek")
  )
}

function usesRail(plan: CommutePlan): boolean {
  return plan.legs.some(
    (l) => l.kind === "krl" || l.kind === "mrt" || l.kind === "lrt"
  )
}

/** Prefer MRT mixes when available, else KRL, else LRT (Jakarta corridor bias). */
function railTier(plan: CommutePlan): number {
  if (plan.legs.some((l) => l.kind === "mrt")) return 3
  if (plan.legs.some((l) => l.kind === "krl")) return 2
  if (plan.legs.some((l) => l.kind === "lrt")) return 1
  return 0
}

function gojekSpend(plan: CommutePlan): number {
  return plan.legs
    .filter((l) => l.kind === "gojek")
    .reduce((s, l) => s + l.costIdr, 0)
}

function pickSorted(
  plans: CommutePlan[],
  cmp: (a: CommutePlan, b: CommutePlan) => number
): CommutePlan {
  return [...plans].sort(cmp)[0]
}

/** Exported for goldens G8/G9 — Best price / time / balance ranking */
export function rankRecommendations(plans: CommutePlan[]): CommutePlan[] {
  if (!plans.length) return []
  const effective = (p: CommutePlan) =>
    p.oneWayCostIdr + VOT_IDR_PER_MIN * p.oneWayMinutes

  const mixPlans = plans.filter((p) => !isDoorToDoorGojek(p))
  const pricePool = mixPlans.length ? mixPlans : plans

  const maxTier = Math.max(0, ...pricePool.map(railTier))
  const tierPool =
    maxTier > 0 ? pricePool.filter((p) => railTier(p) === maxTier) : []
  const railPool = pricePool.filter(usesRail)
  const bestPricePool =
    tierPool.length > 0 ? tierPool : railPool.length > 0 ? railPool : pricePool

  // Fare-first; near-ties prefer less Gojek (MRT→TJ over MRT+long Gojek egress)
  const bestPrice = pickSorted(bestPricePool, (a, b) => {
    const fareDelta = a.oneWayCostIdr - b.oneWayCostIdr
    if (Math.abs(fareDelta) > VOT_TIE_BAND_IDR) return fareDelta
    const gj = gojekSpend(a) - gojekSpend(b)
    if (gj !== 0) return gj
    const ea = effective(a)
    const eb = effective(b)
    return ea - eb || fareDelta || a.oneWayMinutes - b.oneWayMinutes
  })

  const bestTime = pickSorted(
    plans,
    (a, b) =>
      a.oneWayMinutes - b.oneWayMinutes || a.oneWayCostIdr - b.oneWayCostIdr
  )

  const balPool = pricePool
  const maxCost = Math.max(...balPool.map((p) => p.oneWayCostIdr), 1)
  const maxMins = Math.max(...balPool.map((p) => p.oneWayMinutes), 1)
  const bestBalance = pickSorted(
    balPool,
    (a, b) =>
      a.oneWayCostIdr / maxCost +
      a.oneWayMinutes / maxMins -
      (b.oneWayCostIdr / maxCost + b.oneWayMinutes / maxMins)
  )

  const out: CommutePlan[] = []
  const seen = new Set<string>()
  for (const [label, plan] of [
    ["Best price", bestPrice],
    ["Best time", bestTime],
    ["Best balance", bestBalance],
  ] as const) {
    if (seen.has(plan.signature) && out.length) continue
    seen.add(plan.signature)
    out.push({ ...plan, label })
  }
  return out.slice(0, 3)
}

function enumerateSameSystem(
  home: LatLng,
  office: LatLng,
  system: TransitSystem,
  stops: TransitStop[],
  loaded: LoadedTransitSystem,
  pricing: PricingMaster,
  traffic: TrafficMaster,
  walkOnly: boolean
): DraftPlan[] {
  const boards = boardCandidates(home, stops, system)
  const alights = alightCandidates(office, stops, system)
  const plans: DraftPlan[] = []

  for (const board of boards) {
    for (const alight of alights) {
      if (board.id === alight.id) continue
      const accessModes = accessOptions(board, walkOnly)
      const egressModes = accessOptions(alight, walkOnly)
      if (!accessModes.length || !egressModes.length) continue

      for (const am of accessModes) {
        for (const em of egressModes) {
          const ride = rideLeg(
            system,
            board,
            alight,
            loaded.networkGeoJSON,
            pricing,
            traffic
          )
          const legs = [
            accessLeg(
              am,
              home,
              board,
              `${am} → ${board.name}`,
              pricing,
              traffic
            ),
            ride,
            accessLeg(
              em,
              alight,
              office,
              `${alight.name} → office (${em})`,
              pricing,
              traffic
            ),
          ]
          const signature = legs.map((l) => `${l.kind}:${l.label}`).join("|")
          plans.push({
            signature,
            label: `${system.toUpperCase()} mix`,
            legs,
          })
        }
      }
    }
  }
  return plans
}

function enumerateTransfers(
  home: LatLng,
  office: LatLng,
  stops: TransitStop[],
  bySys: Map<TransitSystem, LoadedTransitSystem>,
  pricing: PricingMaster,
  traffic: TrafficMaster,
  walkOnly: boolean
): DraftPlan[] {
  const plans: DraftPlan[] = []
  for (const sysA of TRANSIT_SYSTEMS) {
    // Skip transfer only when sysA is already walkable to office; Gojek-distance
    // still allows A→B (e.g. MRT Bundaran HI → TJ closer to office).
    if (systemWalkReachesOffice(office, stops, sysA)) continue
    const loadedA = bySys.get(sysA)
    if (!loadedA) continue
    const boards = boardCandidates(home, stops, sysA)
    if (!boards.length) continue

    for (const sysB of TRANSIT_SYSTEMS) {
      if (sysB === sysA) continue
      const loadedB = bySys.get(sysB)
      if (!loadedB) continue
      // Destination system must have a stop within ojek of office
      if (!systemReachesOffice(office, stops, sysB)) continue

      const pairs = findInterchanges(sysA, sysB, stops, office).slice(0, 3)
      if (!pairs.length) continue

      for (const board of boards) {
        for (const pair of pairs) {
          const alights = alightCandidates(office, stops, sysB)
          for (const alight of alights) {
            if (pair.b.id === alight.id) continue
            const accessModes = accessOptions(board, walkOnly)
            const egressModes = accessOptions(alight, walkOnly)
            if (!accessModes.length || !egressModes.length) continue
            const xferMeters = pair.meters
            const xferKind: AccessMode = canWalkAccess(xferMeters)
              ? "walk"
              : "gojek"
            if (walkOnly && xferKind === "gojek") continue

            for (const am of accessModes) {
              for (const em of egressModes) {
                const legs = [
                  accessLeg(
                    am,
                    home,
                    board,
                    `${am} → ${board.name}`,
                    pricing,
                    traffic
                  ),
                  rideLeg(
                    sysA,
                    board,
                    pair.a,
                    loadedA.networkGeoJSON,
                    pricing,
                    traffic
                  ),
                  accessLeg(
                    xferKind,
                    pair.a,
                    pair.b,
                    `transfer ${pair.a.name} → ${pair.b.name}`,
                    pricing,
                    traffic
                  ),
                  rideLeg(
                    sysB,
                    pair.b,
                    alight,
                    loadedB.networkGeoJSON,
                    pricing,
                    traffic
                  ),
                  accessLeg(
                    em,
                    alight,
                    office,
                    `${alight.name} → office (${em})`,
                    pricing,
                    traffic
                  ),
                ]
                plans.push({
                  signature: legs.map((l) => `${l.kind}:${l.label}`).join("|"),
                  label: `${sysA.toUpperCase()}→${sysB.toUpperCase()}`,
                  legs,
                })
              }
            }
          }
        }
      }
    }
  }
  return plans
}

function pureGojek(
  home: LatLng,
  office: LatLng,
  pricing: PricingMaster,
  traffic: TrafficMaster
): DraftPlan {
  const meters = haversineMeters(home, office)
  const leg = accessLeg(
    "gojek",
    home,
    office,
    "Door-to-door Gojek",
    pricing,
    traffic
  )
  leg.meters = meters
  return {
    signature: `gojek:door`,
    label: "Gojek only",
    legs: [leg],
  }
}

function roadModeLabel(kind: "motorcycle" | "ojek" | "car"): string {
  if (kind === "ojek") return "Ojek / Gojek"
  if (kind === "car") return "Car"
  return "Motorcycle"
}

async function roadModePlan(
  home: LatLng,
  office: LatLng,
  kind: "motorcycle" | "ojek" | "car",
  pricing: PricingMaster,
  traffic: TrafficMaster,
  wfoDays: number
): Promise<CommutePlan> {
  const route = await getDrivingRoute(home, office)
  const legKind: LegKind = kind === "ojek" ? "gojek" : kind
  const band =
    kind === "motorcycle"
      ? pricing.motorcycle
      : kind === "car"
        ? pricing.car
        : pricing.gojek
  const minutes = peakRoadMinutes(route.durationSec, traffic.peakFactor)
  const cost = fareIdr(band, route.meters)
  const draft: DraftPlan = {
    signature: `${kind}:road`,
    label: roadModeLabel(kind),
    legs: [
      {
        kind: legKind,
        label: roadModeLabel(kind),
        from: home,
        to: office,
        meters: route.meters,
        minutes,
        costIdr: cost,
        coordinates: route.coordinates,
      },
    ],
  }
  return finalizePlan(draft, wfoDays, traffic)
}

export async function planBestPriceMix(
  home: LatLng,
  office: LatLng,
  systems: LoadedTransitSystem[],
  pricing: PricingMaster,
  traffic: TrafficMaster,
  wfoDays: number,
  walkOnly = false
): Promise<CommutePlan[]> {
  const bySys = networkBySystem(systems)
  const stops = allStops(systems)
  let drafts: DraftPlan[] = []

  for (const sys of TRANSIT_SYSTEMS) {
    const loaded = bySys.get(sys)
    if (!loaded) continue
    drafts.push(
      ...enumerateSameSystem(
        home,
        office,
        sys,
        stops,
        loaded,
        pricing,
        traffic,
        walkOnly
      )
    )
  }

  if (!walkOnly) {
    const xfers = enumerateTransfers(
      home,
      office,
      stops,
      bySys,
      pricing,
      traffic,
      walkOnly
    )
    // Keep cheapest draft per transfer family so shortlist cannot drop MRT→TJ
    const cheapestXfer = new Map<string, DraftPlan>()
    for (const d of xfers) {
      const fam = draftFamily(d)
      const prev = cheapestXfer.get(fam)
      const sc = scoreDraft(d)
      if (!prev || sc.cost < scoreDraft(prev).cost) cheapestXfer.set(fam, d)
    }
    drafts.push(...xfers)
    drafts.push(pureGojek(home, office, pricing, traffic))
    drafts = shortlist(drafts)
    for (const d of cheapestXfer.values()) {
      if (drafts.length >= SHORTLIST_CAP) break
      if (!drafts.some((x) => x.signature === d.signature)) drafts.push(d)
    }
  } else {
    drafts = shortlist(drafts)
  }
  const enriched = await Promise.all(
    drafts.map((d) => enrichGojekLegs(d, traffic))
  )
  // Fix gojek fares after OSRM meters
  const withFares = enriched.map((p) => ({
    ...p,
    legs: p.legs.map((leg) =>
      leg.kind === "gojek"
        ? { ...leg, costIdr: fareIdr(pricing.gojek, leg.meters) }
        : leg
    ),
  }))
  const finalized = withFares.map((p) => finalizePlan(p, wfoDays, traffic))
  return rankRecommendations(finalized)
}

export async function planForMode(
  home: Pin,
  office: Pin,
  mode: CommuteMode,
  systems: LoadedTransitSystem[],
  pricing: PricingMaster,
  traffic: TrafficMaster,
  wfoDays: number
): Promise<CommutePlan[]> {
  if (mode === "motorcycle" || mode === "ojek" || mode === "car") {
    return [await roadModePlan(home, office, mode, pricing, traffic, wfoDays)]
  }
  if (mode === "transit") {
    const stops = allStops(systems)
    if (!transitOnlyUnlocked(home, office, stops)) return []
    return planBestPriceMix(
      home,
      office,
      systems,
      pricing,
      traffic,
      wfoDays,
      true
    )
  }
  return planBestPriceMix(
    home,
    office,
    systems,
    pricing,
    traffic,
    wfoDays,
    false
  )
}
