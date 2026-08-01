import {
  SNAP_MAX_M,
  TRANSIT_M_PER_MIN,
  VERTEX_MERGE_M,
} from "@/master/defaults"
import { haversineMeters, lineStringLengthMeters } from "@/lib/routing"
import type { LatLng, TransitSystem } from "@/types"

type NodeId = number

type Graph = {
  nodes: LatLng[]
  /** adjacency: node -> [{to, meters}] */
  edges: Map<NodeId, { to: NodeId; meters: number }[]>
}

const graphCache = new Map<string, Graph>()
const pathCache = new Map<
  string,
  { meters: number; coords: [number, number][] }
>()

function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5
}

function buildGraph(
  system: TransitSystem,
  network: GeoJSON.FeatureCollection
): Graph {
  const cacheKey = system
  const hit = graphCache.get(cacheKey)
  if (hit) return hit

  const nodes: LatLng[] = []
  const keyToId = new Map<string, NodeId>()

  function upsert(lng: number, lat: number): NodeId {
    // Merge nearby vertices within VERTEX_MERGE_M
    for (let i = 0; i < nodes.length; i++) {
      if (haversineMeters(nodes[i], { lat, lng }) <= VERTEX_MERGE_M) {
        return i
      }
    }
    const id = nodes.length
    nodes.push({ lat, lng })
    keyToId.set(`${roundCoord(lng)},${roundCoord(lat)}`, id)
    return id
  }

  const edges = new Map<NodeId, { to: NodeId; meters: number }[]>()

  function addEdge(a: NodeId, b: NodeId, meters: number) {
    if (a === b) return
    const listA = edges.get(a) ?? []
    listA.push({ to: b, meters })
    edges.set(a, listA)
    const listB = edges.get(b) ?? []
    listB.push({ to: a, meters })
    edges.set(b, listB)
  }

  for (const f of network.features) {
    if (!f.geometry || f.geometry.type !== "LineString") continue
    const coords = f.geometry.coordinates as [number, number][]
    if (coords.length < 2) continue
    for (let i = 1; i < coords.length; i++) {
      const [lng0, lat0] = coords[i - 1]
      const [lng1, lat1] = coords[i]
      const a = upsert(lng0, lat0)
      const b = upsert(lng1, lat1)
      const m = haversineMeters(
        { lat: lat0, lng: lng0 },
        { lat: lat1, lng: lng1 }
      )
      addEdge(a, b, m)
    }
  }

  const g: Graph = { nodes, edges }
  graphCache.set(cacheKey, g)
  return g
}

function nearestNode(
  g: Graph,
  p: LatLng
): { id: NodeId; meters: number } | null {
  let best: { id: NodeId; meters: number } | null = null
  for (let i = 0; i < g.nodes.length; i++) {
    const m = haversineMeters(p, g.nodes[i])
    if (!best || m < best.meters) best = { id: i, meters: m }
  }
  if (!best || best.meters > SNAP_MAX_M) return null
  return best
}

function dijkstra(
  g: Graph,
  start: NodeId,
  end: NodeId
): { meters: number; path: NodeId[] } | null {
  const dist = new Map<NodeId, number>()
  const prev = new Map<NodeId, NodeId>()
  const open = new Set<NodeId>([start])
  dist.set(start, 0)

  while (open.size) {
    let u: NodeId | null = null
    let best = Infinity
    for (const id of open) {
      const d = dist.get(id) ?? Infinity
      if (d < best) {
        best = d
        u = id
      }
    }
    if (u == null) break
    open.delete(u)
    if (u === end) break
    for (const e of g.edges.get(u) ?? []) {
      const alt = best + e.meters
      if (alt < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, alt)
        prev.set(e.to, u)
        open.add(e.to)
      }
    }
  }

  if (!dist.has(end)) return null
  const path: NodeId[] = []
  let cur: NodeId | undefined = end
  while (cur != null) {
    path.push(cur)
    cur = prev.get(cur)
  }
  path.reverse()
  return { meters: dist.get(end)!, path }
}

export type NetworkPath = {
  meters: number
  minutes: number
  coordinates: [number, number][]
}

/** Path between two stop pins on one system’s network */
export function pathBetweenStops(
  system: TransitSystem,
  network: GeoJSON.FeatureCollection,
  from: LatLng,
  to: LatLng
): NetworkPath {
  const cacheKey = `${system}:${from.lng.toFixed(4)},${from.lat.toFixed(4)}>${to.lng.toFixed(4)},${to.lat.toFixed(4)}`
  const cached = pathCache.get(cacheKey)
  if (cached) {
    return {
      meters: cached.meters,
      minutes: Math.max(5, cached.meters / TRANSIT_M_PER_MIN),
      coordinates: cached.coords,
    }
  }

  const g = buildGraph(system, network)
  const a = nearestNode(g, from)
  const b = nearestNode(g, to)
  if (!a || !b) {
    const meters = haversineMeters(from, to)
    const coords: [number, number][] = [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]
    pathCache.set(cacheKey, { meters, coords })
    return {
      meters,
      minutes: Math.max(5, meters / TRANSIT_M_PER_MIN),
      coordinates: coords,
    }
  }

  const result = dijkstra(g, a.id, b.id)
  if (!result) {
    const meters = haversineMeters(from, to)
    const coords: [number, number][] = [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]
    pathCache.set(cacheKey, { meters, coords })
    return {
      meters,
      minutes: Math.max(5, meters / TRANSIT_M_PER_MIN),
      coordinates: coords,
    }
  }

  const coords: [number, number][] = [
    [from.lng, from.lat],
    ...result.path.map((id) => {
      const n = g.nodes[id]
      return [n.lng, n.lat] as [number, number]
    }),
    [to.lng, to.lat],
  ]
  const meters = Math.max(result.meters, lineStringLengthMeters(coords) * 0.95)
  pathCache.set(cacheKey, { meters, coords })
  return {
    meters,
    minutes: Math.max(5, meters / TRANSIT_M_PER_MIN),
    coordinates: coords,
  }
}

export function clearNetworkCaches(): void {
  graphCache.clear()
  pathCache.clear()
}
