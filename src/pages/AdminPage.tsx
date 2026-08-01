import { useState } from "react"
import { Link } from "react-router-dom"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  exportMasterJson,
  importMasterJson,
  loadMaster,
  resetMaster,
  saveMaster,
} from "@/master/store"
import type { MasterData, PricingMaster } from "@/types"

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const

export function AdminPage() {
  const { theme, setTheme } = useTheme()
  const [master, setMaster] = useState<MasterData>(() => loadMaster())
  const [importText, setImportText] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const updatePricing = <K extends keyof PricingMaster>(
    key: K,
    field: keyof PricingMaster[K],
    value: number,
  ) => {
    setMaster((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [key]: { ...prev.pricing[key], [field]: value },
      },
    }))
  }

  const persist = () => {
    saveMaster(master)
    setMessage("Saved to localStorage (relocation-maps:master-v1)")
  }

  const doReset = () => {
    const fresh = resetMaster()
    setMaster(fresh)
    setMessage("Reset to defaults")
  }

  const doExport = () => {
    const json = exportMasterJson(master)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "master-data.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = () => {
    try {
      const next = importMasterJson(importText)
      setMaster(next)
      setMessage("Imported and saved")
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Import failed")
    }
  }

  return (
    <div className="bg-background text-foreground mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Master data</h1>
          <p className="text-muted-foreground text-sm">
            Local-only editor. No auth. Transit GeoJSON remains under{" "}
            <code className="text-xs">public/data/transit/</code>.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">← Map</Link>
        </Button>
      </div>

      {message && (
        <p className="bg-muted rounded-md px-3 py-2 text-sm">{message}</p>
      )}

      <section className="space-y-2">
        <h2 className="font-medium">Theme</h2>
        <p className="text-muted-foreground text-xs">
          Applies to UI and map basemap. Default is light.
        </p>
        <div className="flex flex-wrap gap-1">
          {THEME_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={theme === opt.value ? "default" : "outline"}
              onClick={() => setTheme(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Pricing (IDR heuristics)</h2>
        {(
          Object.keys(master.pricing) as (keyof PricingMaster)[]
        ).map((key) => (
          <div key={key} className="grid grid-cols-4 items-end gap-2 text-sm">
            <Label className="col-span-1 capitalize">{key}</Label>
            <div>
              <Label className="text-xs">base</Label>
              <Input
                type="number"
                value={master.pricing[key].base}
                onChange={(e) =>
                  updatePricing(key, "base", Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label className="text-xs">perKm</Label>
              <Input
                type="number"
                value={master.pricing[key].perKm}
                onChange={(e) =>
                  updatePricing(key, "perKm", Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label className="text-xs">kmCap</Label>
              <Input
                type="number"
                value={master.pricing[key].kmCap ?? ""}
                placeholder="—"
                onChange={(e) =>
                  updatePricing(
                    key,
                    "kmCap",
                    e.target.value ? Number(e.target.value) : 0,
                  )
                }
              />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Preset offices (JSON)</h2>
        <Textarea
          className="font-mono text-xs"
          rows={6}
          value={JSON.stringify(master.offices, null, 2)}
          onChange={(e) => {
            try {
              const offices = JSON.parse(e.target.value) as MasterData["offices"]
              setMaster((prev) => ({ ...prev, offices }))
            } catch {
              /* keep typing */
            }
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Preset homes (JSON)</h2>
        <Textarea
          className="font-mono text-xs"
          rows={8}
          value={JSON.stringify(master.homes, null, 2)}
          onChange={(e) => {
            try {
              const homes = JSON.parse(e.target.value) as MasterData["homes"]
              setMaster((prev) => ({ ...prev, homes }))
            } catch {
              /* keep typing */
            }
          }}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={persist}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={doExport}>
          Export JSON
        </Button>
        <Button type="button" variant="secondary" onClick={doReset}>
          Reset defaults
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Import JSON</h2>
        <Textarea
          className="font-mono text-xs"
          rows={6}
          placeholder="Paste master JSON…"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={doImport}>
          Import & save
        </Button>
      </section>
    </div>
  )
}

export default AdminPage
