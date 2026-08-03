import {
  ALIGHT_CANDIDATES,
  BOARD_CANDIDATES,
  INTERCHANGE_M,
  OJEK_FEEDER_M,
  WALK_UNLOCK_M,
} from "@/master/defaults"
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

/** Board: nearest stop only within ojek radius (prefer closest over farther stations) */
export function boardCandidates(
  home: LatLng,
  stops: TransitStop[],
  system: TransitSystem
): (TransitStop & { meters: number })[] {
  return nearestStops(home, stops, system, BOARD_CANDIDATES, OJEK_FEEDER_M)
}

/** Alight: nearest stop only within ojek radius of office */
export function alightCandidates(
  office: LatLng,
  stops: TransitStop[],
  system: TransitSystem
): (TransitStop & { meters: number })[] {
  return nearestStops(office, stops, system, ALIGHT_CANDIDATES, OJEK_FEEDER_M)
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

/** Feeder reach: any stop of system within ojek of office (same-system last mile OK) */
export function systemReachesOffice(
  office: LatLng,
  stops: TransitStop[],
  system: TransitSystem
): boolean {
  return stops.some(
    (s) => s.system === system && haversineMeters(office, s) <= OJEK_FEEDER_M
  )
}

/**
 * Walk reach: stop within walk unlock of office.
 * Used to decide if a cross-system transfer is warranted — if the rider would
 * already need Gojek from system A, allow A→B (e.g. MRT → TJ) for a closer stop.
 */
export function systemWalkReachesOffice(
  office: LatLng,
  stops: TransitStop[],
  system: TransitSystem
): boolean {
  return stops.some(
    (s) => s.system === system && haversineMeters(office, s) <= WALK_UNLOCK_M
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
