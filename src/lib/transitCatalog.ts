import type {
  LoadedTransitSystem,
  TransitCatalogEntry,
  TransitStop,
  TransitSystem,
} from "@/types"

type CatalogFile = { systems: TransitCatalogEntry[] }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return res.json() as Promise<T>
}

function parseStops(
  system: TransitSystem,
  fc: GeoJSON.FeatureCollection
): TransitStop[] {
  const stops: TransitStop[] = []
  for (let i = 0; i < fc.features.length; i++) {
    const f = fc.features[i]
    if (!f.geometry || f.geometry.type !== "Point") continue
    const [lng, lat] = f.geometry.coordinates as [number, number]
    const name =
      (f.properties?.name as string | undefined) ?? `${system}-stop-${i}`
    stops.push({
      id: `${system}:${i}:${name}`,
      name,
      system,
      lat,
      lng,
    })
  }
  return stops
}

export async function loadTransitCatalog(): Promise<LoadedTransitSystem[]> {
  const catalog = await fetchJson<CatalogFile>("/data/transit/catalog.json")
  const loaded: LoadedTransitSystem[] = []

  for (const entry of catalog.systems) {
    const folder = entry.folder || entry.id
    const base = `/data/transit/${folder}`
    const [stopsGeoJSON, networkGeoJSON] = await Promise.all([
      fetchJson<GeoJSON.FeatureCollection>(`${base}/stops.geojson`),
      fetchJson<GeoJSON.FeatureCollection>(`${base}/network.geojson`),
    ])
    const id = entry.id as TransitSystem
    loaded.push({
      id,
      label: entry.label,
      stops: parseStops(id, stopsGeoJSON),
      stopsGeoJSON,
      networkGeoJSON,
    })
  }

  return loaded
}
