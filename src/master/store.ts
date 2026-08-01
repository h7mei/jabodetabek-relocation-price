import {
  DEFAULT_HOMES,
  DEFAULT_MASTER,
  DEFAULT_OFFICES,
  MASTER_STORAGE_KEY,
} from "@/master/defaults"
import type { MasterData, PresetPlace } from "@/types"

/** Pre-expansion chip sets — swap for defaults when still untouched */
const LEGACY_OFFICE_IDS = new Set(["scbd", "kuningan", "bsd"])
const LEGACY_HOME_IDS = new Set(["bekasi-barat", "depok", "tangerang", "bogor"])

function isMasterData(v: unknown): v is MasterData {
  if (!v || typeof v !== "object") return false
  const o = v as MasterData
  return (
    o.version === 1 &&
    !!o.pricing &&
    Array.isArray(o.offices) &&
    Array.isArray(o.homes)
  )
}

function resolvePresets(
  saved: PresetPlace[],
  legacyIds: Set<string>,
  next: PresetPlace[]
): PresetPlace[] {
  if (
    saved.length === legacyIds.size &&
    saved.every((p) => legacyIds.has(p.id))
  ) {
    return structuredClone(next)
  }
  return saved
}

export function loadMaster(): MasterData {
  try {
    const raw = localStorage.getItem(MASTER_STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_MASTER)
    const parsed: unknown = JSON.parse(raw)
    if (!isMasterData(parsed)) return structuredClone(DEFAULT_MASTER)
    return {
      ...structuredClone(DEFAULT_MASTER),
      ...parsed,
      pricing: { ...DEFAULT_MASTER.pricing, ...parsed.pricing },
      offices: resolvePresets(
        parsed.offices,
        LEGACY_OFFICE_IDS,
        DEFAULT_OFFICES
      ),
      homes: resolvePresets(parsed.homes, LEGACY_HOME_IDS, DEFAULT_HOMES),
    }
  } catch {
    return structuredClone(DEFAULT_MASTER)
  }
}

export function saveMaster(data: MasterData): void {
  localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(data))
}

export function resetMaster(): MasterData {
  const fresh = structuredClone(DEFAULT_MASTER)
  saveMaster(fresh)
  return fresh
}

export function exportMasterJson(data: MasterData): string {
  return JSON.stringify(data, null, 2)
}

export function importMasterJson(text: string): MasterData {
  const parsed: unknown = JSON.parse(text)
  if (!isMasterData(parsed)) throw new Error("Invalid master JSON")
  const merged: MasterData = {
    version: 1,
    pricing: { ...DEFAULT_MASTER.pricing, ...parsed.pricing },
    offices: parsed.offices,
    homes: parsed.homes,
  }
  saveMaster(merged)
  return merged
}
