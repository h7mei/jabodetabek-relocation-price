import type { MasterData, PricingMaster, PresetPlace } from "@/types"

/** Heuristic fares — JakLingko / Gojek-like bands, not live quotes */
export const DEFAULT_PRICING: PricingMaster = {
  gojek: { base: 8_000, perKm: 2_500 },
  motorcycle: { base: 0, perKm: 900 },
  car: { base: 0, perKm: 2_200 },
  krl: { base: 3_000, perKm: 500, kmCap: 50 },
  mrt: { base: 3_000, perKm: 1_000, kmCap: 20 },
  lrt: { base: 3_000, perKm: 800, kmCap: 25 },
  transjakarta: { base: 3_500, perKm: 0, kmCap: 0 },
}

export const DEFAULT_OFFICES: PresetPlace[] = [
  { id: "scbd", label: "SCBD / Sudirman", lat: -6.2275, lng: 106.8085 },
  { id: "kuningan", label: "Kuningan", lat: -6.2297, lng: 106.8295 },
  { id: "bsd", label: "BSD City", lat: -6.3018, lng: 106.6525 },
]

export const DEFAULT_HOMES: PresetPlace[] = [
  { id: "bekasi-barat", label: "Bekasi Barat", lat: -6.2383, lng: 106.9756 },
  { id: "depok", label: "Depok", lat: -6.4025, lng: 106.7942 },
  { id: "tangerang", label: "Tangerang", lat: -6.1783, lng: 106.6319 },
  { id: "bogor", label: "Bogor Kota", lat: -6.5971, lng: 106.799 },
]

export const DEFAULT_MASTER: MasterData = {
  version: 1,
  pricing: DEFAULT_PRICING,
  offices: DEFAULT_OFFICES,
  homes: DEFAULT_HOMES,
}

export const MASTER_STORAGE_KEY = "relocation-maps:master-v1"

export const JAKARTA_CENTER: [number, number] = [106.8272, -6.1754]
export const DEFAULT_ZOOM = 11

export const WALK_UNLOCK_M = 1_200
export const OJEK_FEEDER_M = 8_000
export const MOVE_HOME_M = 400
export const INTERCHANGE_M = 600
export const VERTEX_MERGE_M = 120
export const SNAP_MAX_M = 2_500
export const PEAK_FACTOR = 1.45
export const P80_FACTOR = 1.4
export const WEEKS_PER_MONTH = 4.33
export const WALK_M_PER_MIN = 80
export const TRANSIT_M_PER_MIN = 350
export const OJEK_KMH = 22
export const SHORTLIST_CAP = 28
export const PRICE_BAND_IDR = 5_000
export const DEFAULT_SALARY = 12_000_000
export const DEFAULT_WFO_DAYS = 3
