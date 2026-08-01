/** Transit system ids — must match public/data/transit/catalog.json */
export type TransitSystem = "krl" | "mrt" | "lrt" | "transjakarta"

export const TRANSIT_SYSTEMS: TransitSystem[] = [
  "krl",
  "mrt",
  "lrt",
  "transjakarta",
]

export const TRANSIT_COLORS: Record<TransitSystem, string> = {
  krl: "#e11d48",
  mrt: "#2563eb",
  lrt: "#ca8a04",
  transjakarta: "#16a34a",
}

export type CommuteMode = "cheapest" | "motorcycle" | "ojek" | "car" | "transit"

export const COMMUTE_MODE_LABELS: Record<CommuteMode, string> = {
  cheapest: "Best price mix",
  motorcycle: "Motorcycle",
  ojek: "Ojek",
  car: "Car",
  transit: "Transit only",
}

export const COMMUTE_MODES: CommuteMode[] = [
  "cheapest",
  "motorcycle",
  "ojek",
  "car",
  "transit",
]

export type LatLng = { lat: number; lng: number }

export type PinKind = "office" | "home"

export type Pin = LatLng & {
  id: string
  label: string
  kind: PinKind
  /** Per-home commute mode (homes only; default cheapest) */
  mode?: CommuteMode
}

export type PresetPlace = LatLng & {
  id: string
  label: string
}

export type FareBand = {
  base: number
  perKm: number
  /** Cap km billed (transit) */
  kmCap?: number
}

export type PricingMaster = {
  gojek: FareBand
  motorcycle: FareBand
  car: FareBand
  krl: FareBand
  mrt: FareBand
  lrt: FareBand
  transjakarta: FareBand
}

export type LegKind =
  | "walk"
  | "gojek"
  | "motorcycle"
  | "car"
  | "krl"
  | "mrt"
  | "lrt"
  | "transjakarta"

export type PlanLeg = {
  kind: LegKind
  label: string
  from: LatLng
  to: LatLng
  meters: number
  minutes: number
  costIdr: number
  /** [lng, lat] polyline when available */
  coordinates?: [number, number][]
}

export type CommutePlan = {
  signature: string
  label: string
  legs: PlanLeg[]
  oneWayMinutes: number
  oneWayCostIdr: number
  dailyRtCostIdr: number
  monthlyCostIdr: number
  monthlyHours: number
  p50Minutes: number
  p80Minutes: number
}

export type RankedHomeResult = {
  home: Pin
  mode: CommuteMode
  plans: CommutePlan[]
  /** Primary plan used for ranking row (best for mode) */
  primary: CommutePlan
}

export type ScenarioResult = {
  office: Pin
  wfoDays: number
  ranked: RankedHomeResult[]
}

export type TransitStop = {
  id: string
  name: string
  system: TransitSystem
  lat: number
  lng: number
}

export type TransitCatalogEntry = {
  id: TransitSystem
  label: string
  folder: string
}

export type MasterData = {
  version: 1
  pricing: PricingMaster
  offices: PresetPlace[]
  homes: PresetPlace[]
}

export type GeoJSONFeatureCollection = GeoJSON.FeatureCollection

export type LoadedTransitSystem = {
  id: TransitSystem
  label: string
  stops: TransitStop[]
  stopsGeoJSON: GeoJSON.FeatureCollection
  networkGeoJSON: GeoJSON.FeatureCollection
}
