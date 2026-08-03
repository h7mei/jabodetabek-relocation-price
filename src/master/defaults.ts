import type {
  MasterData,
  PricingMaster,
  PresetPlace,
  TrafficMaster,
} from "@/types"

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

/**
 * Offer-office presets: CBD first (Sudirman/SCBD dominate ~40% of CBD stock),
 * then major non-CBD / satellite clusters candidates commonly get offers in.
 * Pins sit near MRT/KRL/TJ corridors where possible.
 */
export const DEFAULT_OFFICES: PresetPlace[] = [
  // CBD core
  { id: "scbd", label: "SCBD / Sudirman", lat: -6.2275, lng: 106.8085 },
  { id: "thamrin", label: "Thamrin / HI", lat: -6.1945, lng: 106.823 },
  { id: "kuningan", label: "Kuningan", lat: -6.2297, lng: 106.8295 },
  { id: "mega-kuningan", label: "Mega Kuningan", lat: -6.2285, lng: 106.8255 },
  { id: "senayan", label: "Senayan", lat: -6.2267, lng: 106.8025 },
  // Non-CBD Jakarta
  { id: "simatupang", label: "TB Simatupang", lat: -6.2935, lng: 106.821 },
  { id: "tebet", label: "Tebet / Casablanca", lat: -6.2267, lng: 106.8483 },
  { id: "kelapa-gading", label: "Kelapa Gading", lat: -6.1575, lng: 106.9095 },
  { id: "puri", label: "Puri Indah", lat: -6.1875, lng: 106.7355 },
  // Satellite / outbound CBDs
  { id: "bsd", label: "BSD City", lat: -6.3018, lng: 106.6525 },
  { id: "alam-sutera", label: "Alam Sutera", lat: -6.2255, lng: 106.6525 },
  { id: "karawaci", label: "Lippo Karawaci", lat: -6.225, lng: 106.606 },
]

/**
 * Feeder-home presets ordered by BPS Statistik Komuter Jabodetabek 2023
 * worker-commuter origins (absolute count): Kab. Bogor → Kota Bekasi →
 * Kota Depok, then Tangsel / Tangerang corridors. Pins sit near KRL/LRT
 * so walk / ojek unlock works out of the box.
 */
export const DEFAULT_HOMES: PresetPlace[] = [
  // Kab. Bogor — largest absolute worker-commuter origin (~460k)
  { id: "bojong-gede", label: "Bojong Gede", lat: -6.47, lng: 106.805 },
  { id: "cilebut", label: "Cilebut", lat: -6.52, lng: 106.798 },
  { id: "bogor", label: "Bogor Kota", lat: -6.5971, lng: 106.799 },
  // Kota Depok — highest share of residents who commute (24.5%)
  { id: "depok", label: "Depok", lat: -6.3917, lng: 106.8142 },
  { id: "pondok-cina", label: "Pondok Cina", lat: -6.372, lng: 106.832 },
  // Kota Bekasi — ~406k worker commuters
  { id: "bekasi-barat", label: "Bekasi Barat", lat: -6.2383, lng: 106.9756 },
  { id: "bekasi-timur", label: "Bekasi Timur", lat: -6.245, lng: 107.018 },
  { id: "cikarang", label: "Cikarang", lat: -6.275, lng: 107.145 },
  // Kota Tangerang Selatan — high % of commuters headed to DKI
  { id: "ciputat", label: "Ciputat", lat: -6.28, lng: 106.745 },
  { id: "serpong", label: "Serpong", lat: -6.32, lng: 106.67 },
  { id: "cisauk", label: "Cisauk", lat: -6.33, lng: 106.648 },
  // Kota Tangerang + east-Jakarta LRT feeder
  { id: "tangerang", label: "Tangerang", lat: -6.1783, lng: 106.6319 },
  { id: "cibubur", label: "Cibubur", lat: -6.37, lng: 106.895 },
]

export const PEAK_FACTOR = 1.45
export const P80_FACTOR = 1.4

export const DEFAULT_TRAFFIC: TrafficMaster = {
  peakFactor: PEAK_FACTOR,
  p80Factor: P80_FACTOR,
}

export const DEFAULT_MASTER: MasterData = {
  version: 1,
  pricing: DEFAULT_PRICING,
  traffic: DEFAULT_TRAFFIC,
  offices: DEFAULT_OFFICES,
  homes: DEFAULT_HOMES,
}

export const MASTER_STORAGE_KEY = "relocation-maps:master-v1"

export const JAKARTA_CENTER: [number, number] = [106.8272, -6.1754]
export const DEFAULT_ZOOM = 11

/** Walk to PT stop only when pin ≤ this distance; farther feeders prefer Gojek */
export const WALK_UNLOCK_M = 500
export const OJEK_FEEDER_M = 8_000
export const MOVE_HOME_M = 400
export const INTERCHANGE_M = 600
export const VERTEX_MERGE_M = 120
export const SNAP_MAX_M = 2_500
/** Board: nearest stop only (prefer closest PT over farther-but-faster stations) */
export const BOARD_CANDIDATES = 1
/** Alight: nearest stop only (same nearest-stop preference as board) */
export const ALIGHT_CANDIDATES = 1
export const WEEKS_PER_MONTH = 4.33
export const WALK_M_PER_MIN = 80
export const TRANSIT_M_PER_MIN = 350
export const OJEK_KMH = 22
export const SHORTLIST_CAP = 28
/** Near-cheapest fare band (legacy / shortlist hints); Best price uses VOT */
export const PRICE_BAND_IDR = 5_000
/** Value of time for Best price: minimize fare + VOT × minutes */
export const VOT_IDR_PER_MIN = 1_000
/** If two plans’ effective costs differ by ≤ this, prefer lower fare (avoid micro-VOT flips) */
export const VOT_TIE_BAND_IDR = 1_000
export const DEFAULT_WFO_DAYS = 3
