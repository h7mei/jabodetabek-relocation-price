import { OJEK_KMH, PEAK_FACTOR } from "@/master/defaults"
import type { LatLng } from "@/types"

const EARTH_R = 6_371_000

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function straightLineMinutes(meters: number, kmh = OJEK_KMH): number {
  return (meters / 1000 / kmh) * 60
}

export function lineStringLengthMeters(coords: [number, number][]): number {
  let sum = 0
  for (let i = 1; i < coords.length; i++) {
    const [lng0, lat0] = coords[i - 1]
    const [lng1, lat1] = coords[i]
    sum += haversineMeters({ lat: lat0, lng: lng0 }, { lat: lat1, lng: lng1 })
  }
  return sum
}

export type RoadRoute = {
  meters: number
  durationSec: number
  coordinates: [number, number][]
  estimated: boolean
}

const cache = new Map<string, RoadRoute>()
const inflight = new Map<string, Promise<RoadRoute>>()

function key(a: LatLng, b: LatLng): string {
  return `${a.lng.toFixed(5)},${a.lat.toFixed(5)};${b.lng.toFixed(5)},${b.lat.toFixed(5)}`
}

function fallbackRoute(a: LatLng, b: LatLng): RoadRoute {
  const meters = haversineMeters(a, b)
  const minutes = straightLineMinutes(meters)
  return {
    meters,
    durationSec: minutes * 60,
    coordinates: [
      [a.lng, a.lat],
      [b.lng, b.lat],
    ],
    estimated: true,
  }
}

async function fetchOsrm(a: LatLng, b: LatLng): Promise<RoadRoute> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) return fallbackRoute(a, b)
    const data = (await res.json()) as {
      code?: string
      routes?: {
        distance: number
        duration: number
        geometry: { coordinates: [number, number][] }
      }[]
    }
    const route = data.routes?.[0]
    if (!route || data.code !== "Ok") return fallbackRoute(a, b)
    return {
      meters: route.distance,
      durationSec: route.duration,
      coordinates: route.geometry.coordinates,
      estimated: false,
    }
  } catch {
    return fallbackRoute(a, b)
  }
}

/** Cached + coalesced OSRM driving route; falls back to ~22 km/h straight line */
export async function getDrivingRoute(
  a: LatLng,
  b: LatLng
): Promise<RoadRoute> {
  const k = key(a, b)
  const hit = cache.get(k)
  if (hit) return hit
  const pending = inflight.get(k)
  if (pending) return pending
  const p = fetchOsrm(a, b).then((r) => {
    cache.set(k, r)
    inflight.delete(k)
    return r
  })
  inflight.set(k, p)
  return p
}

export function peakRoadMinutes(durationSec: number): number {
  return (durationSec / 60) * PEAK_FACTOR
}
