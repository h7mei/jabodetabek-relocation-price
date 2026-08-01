import { useEffect, useEffectEvent } from "react"

import {
  Map,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerLabel,
  useMap,
} from "@/components/ui/map"
import { FAST_MAP_OPTIONS, FAST_MAP_STYLES } from "@/lib/mapStyle"
import {
  DEFAULT_ZOOM,
  JAKARTA_CENTER,
} from "@/master/defaults"
import {
  TRANSIT_COLORS,
  type CommutePlan,
  type LoadedTransitSystem,
  type Pin,
  type TransitSystem,
} from "@/types"

const LEG_COLORS: Record<string, string> = {
  walk: "#64748b",
  gojek: "#22c55e",
  motorcycle: "#0ea5e9",
  car: "#8b5cf6",
  krl: TRANSIT_COLORS.krl,
  mrt: TRANSIT_COLORS.mrt,
  lrt: TRANSIT_COLORS.lrt,
  transjakarta: TRANSIT_COLORS.transjakarta,
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lng: number, lat: number) => void
}) {
  const { map, isLoaded } = useMap()
  const onClick = useEffectEvent(onMapClick)

  useEffect(() => {
    if (!map || !isLoaded) return
    const handler = (e: { lngLat: { lng: number; lat: number } }) => {
      onClick(e.lngLat.lng, e.lngLat.lat)
    }
    map.on("click", handler)
    map.getCanvas().style.cursor = "crosshair"
    return () => {
      map.off("click", handler)
      map.getCanvas().style.cursor = ""
    }
  }, [map, isLoaded])

  return null
}

function PtLayers({
  systems,
  enabled,
}: {
  systems: LoadedTransitSystem[]
  enabled: Record<TransitSystem, boolean>
}) {
  return (
    <>
      {systems.map((s) =>
        enabled[s.id] ? (
          <MapGeoJSON
            key={`${s.id}-net`}
            id={`${s.id}-net`}
            data={s.networkGeoJSON}
            fillPaint={false}
            linePaint={{
              "line-color": TRANSIT_COLORS[s.id],
              "line-width": 2.5,
              "line-opacity": 0.75,
            }}
          />
        ) : null,
      )}
    </>
  )
}

function StopCircles({
  systems,
  enabled,
}: {
  systems: LoadedTransitSystem[]
  enabled: Record<TransitSystem, boolean>
}) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    for (const s of systems) {
      if (!enabled[s.id]) continue
      const sourceId = `stops-src-${s.id}`
      const layerId = `stops-lyr-${s.id}`
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: "geojson", data: s.stopsGeoJSON })
      }
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": 3.5,
            "circle-color": TRANSIT_COLORS[s.id],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff",
          },
        })
      }
    }

    return () => {
      for (const s of systems) {
        const layerId = `stops-lyr-${s.id}`
        const sourceId = `stops-src-${s.id}`
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId)
          if (map.getSource(sourceId)) map.removeSource(sourceId)
        } catch {
          /* style reload */
        }
      }
    }
  }, [map, isLoaded, systems, enabled])

  return null
}

export type ScenarioMapProps = {
  office: Pin | null
  homes: Pin[]
  transit: LoadedTransitSystem[]
  ptEnabled: Record<TransitSystem, boolean>
  selectedPlan: CommutePlan | null
  onMapClick: (lng: number, lat: number) => void
}

export function ScenarioMap({
  office,
  homes,
  transit,
  ptEnabled,
  selectedPlan,
  onMapClick,
}: ScenarioMapProps) {
  const routeLegs = selectedPlan?.legs ?? []

  return (
    <Map
      styles={FAST_MAP_STYLES}
      center={JAKARTA_CENTER}
      zoom={DEFAULT_ZOOM}
      className="absolute inset-0"
      {...FAST_MAP_OPTIONS}
    >
      <MapControls showZoom showCompass={false} />
      <MapClickHandler onMapClick={onMapClick} />
      <PtLayers systems={transit} enabled={ptEnabled} />
      <StopCircles systems={transit} enabled={ptEnabled} />

      {office && (
        <MapMarker longitude={office.lng} latitude={office.lat}>
          <MarkerContent>
            <div className="bg-primary size-4 rounded-full border-2 border-white shadow" />
          </MarkerContent>
          <MarkerLabel>{office.label}</MarkerLabel>
        </MapMarker>
      )}
      {homes.map((h) => (
        <MapMarker key={h.id} longitude={h.lng} latitude={h.lat}>
          <MarkerContent>
            <div className="size-4 rounded-full border-2 border-white bg-amber-500 shadow" />
          </MarkerContent>
          <MarkerLabel>{h.label}</MarkerLabel>
        </MapMarker>
      ))}

      {routeLegs.map((leg, i) =>
        leg.coordinates && leg.coordinates.length >= 2 ? (
          <MapRoute
            key={`${selectedPlan?.signature}-${i}`}
            coordinates={leg.coordinates}
            color={LEG_COLORS[leg.kind] ?? "#4285F4"}
            width={4}
            interactive={false}
          />
        ) : null,
      )}
    </Map>
  )
}

export default ScenarioMap
