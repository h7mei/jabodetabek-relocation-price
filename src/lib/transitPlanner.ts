import { INTERCHANGE_M, OJEK_FEEDER_M, WALK_UNLOCK_M } from "@/master/defaults"
import { haversineMeters } from "@/lib/routing"
import type { LatLng, TransitStop, TransitSystem } from "@/types"

export function nearestStops(
  pin: LatLng,
  stops: TransitStop[],
  system: TransitSystem,
  limit: number,
  maxMeters: number
): (TransitStop & { meters: number })[] {
  return stops
    .filter((s) => s.system === system)
    .map((s) => ({ ...s, meters: haversineMeters(pin, s) }))
    .filter((s) => s.meters <= maxMeters)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit)
}

/** Board candidates: top 3 within walk OR within ojek radius */
export function boardCandidates(
  home: LatLng,
  stops: TransitStop[],
  system: TransitSystem
): (TransitStop & { meters: number })[] {
  const withinOjek = nearestStops(home, stops, system, 3, OJEK_FEEDER_M)
  return withinOjek
}

/** Alight candidates: top 5 within walk OR ojek radius of office */
export function alightCandidates(
  office: LatLng,
  stops: TransitStop[],
  system: TransitSystem
): (TransitStop & { meters: number })[] {
  return nearestStops(office, stops, system, 5, OJEK_FEEDER_M)
}

export function canWalkAccess(meters: number): boolean {
  return meters <= WALK_UNLOCK_M
}

export function canOjekAccess(meters: number): boolean {
  return meters <= OJEK_FEEDER_M
}

export function transitOnlyUnlocked(
  home: LatLng,
  office: LatLng,
  stops: TransitStop[]
): boolean {
  const nearHome = stops.some((s) => haversineMeters(home, s) <= WALK_UNLOCK_M)
  const nearOffice = stops.some(
    (s) => haversineMeters(office, s) <= WALK_UNLOCK_M
  )
  return nearHome && nearOffice
}

/** Same boarding system reaches office if any stop of that system is within ojek of office */
export function systemReachesOffice(
  office: LatLng,
  stops: TransitStop[],
  system: TransitSystem
): boolean {
  return stops.some(
    (s) => s.system === system && haversineMeters(office, s) <= OJEK_FEEDER_M
  )
}

export type InterchangePair = {
  a: TransitStop
  b: TransitStop
  meters: number
}

/** Real co-located stops of different systems ≤ 600 m; prefer closer to office */
export function findInterchanges(
  systemA: TransitSystem,
  systemB: TransitSystem,
  stops: TransitStop[],
  office: LatLng
): InterchangePair[] {
  const aStops = stops.filter((s) => s.system === systemA)
  const bStops = stops.filter((s) => s.system === systemB)
  const pairs: InterchangePair[] = []
  for (const a of aStops) {
    for (const b of bStops) {
      const m = haversineMeters(a, b)
      if (m <= INTERCHANGE_M) {
        pairs.push({ a, b, meters: m })
      }
    }
  }
  pairs.sort(
    (p, q) =>
      haversineMeters(office, p.b) +
      p.meters -
      (haversineMeters(office, q.b) + q.meters)
  )
  return pairs
}
