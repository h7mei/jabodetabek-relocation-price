import { lazy, Suspense, useEffect, useId, useRef, useState } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { formatIdr, pctOfSalary } from "@/lib/commute"
import { planForMode } from "@/lib/multimodalPlanner"
import { buildDecisionBrief, downloadText } from "@/lib/report"
import { haversineMeters } from "@/lib/routing"
import { loadTransitCatalog } from "@/lib/transitCatalog"
import {
  DEFAULT_SALARY,
  DEFAULT_WFO_DAYS,
  MAX_HOMES,
  MOVE_HOME_M,
} from "@/master/defaults"
import { loadMaster } from "@/master/store"
import {
  TRANSIT_COLORS,
  TRANSIT_SYSTEMS,
  type CommuteMode,
  type CommutePlan,
  type LoadedTransitSystem,
  type Pin,
  type RankedHomeResult,
  type TransitSystem,
} from "@/types"

const ScenarioMap = lazy(() => import("@/components/ScenarioMap"))

type PlacementStep = "office" | "homes" | "done"

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function MapPage() {
  const [master] = useState(() => loadMaster())
  const [transit, setTransit] = useState<LoadedTransitSystem[]>([])
  const [office, setOffice] = useState<Pin | null>(null)
  const [homes, setHomes] = useState<Pin[]>([])
  const [step, setStep] = useState<PlacementStep>("office")
  const [mode, setMode] = useState<CommuteMode>("cheapest")
  const [salary, setSalary] = useState(DEFAULT_SALARY)
  const [wfoDays, setWfoDays] = useState(DEFAULT_WFO_DAYS)
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [ptEnabled, setPtEnabled] = useState<Record<TransitSystem, boolean>>({
    krl: false,
    mrt: false,
    lrt: false,
    transjakarta: false,
  })
  const [ranked, setRanked] = useState<RankedHomeResult[]>([])
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<CommutePlan | null>(null)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formId = useId()
  const compareGen = useRef(0)
  const selectedHomeIdRef = useRef<string | null>(null)
  selectedHomeIdRef.current = selectedHomeId

  useEffect(() => {
    loadTransitCatalog()
      .then(setTransit)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load transit"),
      )
  }, [])

  // Auto-compute whenever office + homes (and mode/inputs) change
  useEffect(() => {
    if (!office || homes.length === 0 || transit.length === 0) {
      setRanked([])
      setSelectedPlan(null)
      setSelectedHomeId(null)
      setComputing(false)
      return
    }

    const gen = ++compareGen.current
    const timer = window.setTimeout(() => {
      void (async () => {
        setComputing(true)
        setError(null)
        try {
          const results: RankedHomeResult[] = []
          for (const home of homes) {
            const plans = await planForMode(
              home,
              office,
              mode,
              transit,
              master.pricing,
              wfoDays,
            )
            if (gen !== compareGen.current) return
            if (!plans.length) {
              results.push({
                home,
                plans: [],
                primary: {
                  signature: "none",
                  label: "No plan",
                  legs: [],
                  oneWayMinutes: 0,
                  oneWayCostIdr: 0,
                  dailyRtCostIdr: 0,
                  monthlyCostIdr: 0,
                  monthlyHours: 0,
                  p50Minutes: 0,
                  p80Minutes: 0,
                },
                rentIdr: home.rentIdr ?? 0,
                totalMonthlyIdr: home.rentIdr ?? 0,
                pctSalary: pctOfSalary(home.rentIdr ?? 0, salary),
              })
              continue
            }
            const primary = plans[0]
            const rentIdr = home.rentIdr ?? 0
            const totalMonthlyIdr = primary.monthlyCostIdr + rentIdr
            results.push({
              home,
              plans,
              primary,
              rentIdr,
              totalMonthlyIdr,
              pctSalary: pctOfSalary(totalMonthlyIdr, salary),
            })
          }
          if (gen !== compareGen.current) return
          results.sort((a, b) => a.totalMonthlyIdr - b.totalMonthlyIdr)
          const prevId = selectedHomeIdRef.current
          const row =
            results.find((r) => r.home.id === prevId) ?? results[0] ?? null
          setRanked(results)
          setSelectedHomeId(row?.home.id ?? null)
          setSelectedPlan(row?.primary ?? null)
        } catch (e: unknown) {
          if (gen !== compareGen.current) return
          setError(e instanceof Error ? e.message : "Compare failed")
        } finally {
          if (gen === compareGen.current) setComputing(false)
        }
      })()
    }, 280)

    return () => {
      window.clearTimeout(timer)
      compareGen.current += 1
    }
  }, [office, homes, mode, wfoDays, salary, transit, master.pricing])

  const handleMapClick = (lng: number, lat: number) => {
    if (step === "office" || !office) {
      setOffice({
        id: uid("office"),
        kind: "office",
        label: "Office",
        lat,
        lng,
      })
      setStep("homes")
      return
    }

    const near = homes.find(
      (h) => haversineMeters(h, { lat, lng }) <= MOVE_HOME_M,
    )
    if (near) {
      setHomes((prev) =>
        prev.map((h) => (h.id === near.id ? { ...h, lat, lng } : h)),
      )
      return
    }
    if (homes.length >= MAX_HOMES) return
    const n = homes.length + 1
    setHomes((prev) => [
      ...prev,
      {
        id: uid("home"),
        kind: "home",
        label: `Home ${n}`,
        lat,
        lng,
      },
    ])
    if (homes.length + 1 >= 1) setStep("done")
  }

  const placeOfficePreset = (id: string) => {
    const p = master.offices.find((o) => o.id === id)
    if (!p) return
    setOffice({
      id: uid("office"),
      kind: "office",
      label: p.label,
      lat: p.lat,
      lng: p.lng,
    })
    setStep("homes")
  }

  const addHomePreset = (id: string) => {
    if (homes.length >= MAX_HOMES) return
    const p = master.homes.find((h) => h.id === id)
    if (!p) return
    setHomes((prev) => [
      ...prev,
      {
        id: uid("home"),
        kind: "home",
        label: p.label,
        lat: p.lat,
        lng: p.lng,
      },
    ])
    setStep("done")
  }

  const exportBrief = () => {
    if (!office || !ranked.length) return
    const text = buildDecisionBrief({
      candidateName: name || undefined,
      company: company || undefined,
      office,
      mode,
      wfoDays,
      salaryIdr: salary,
      ranked,
    })
    downloadText("decision-brief.txt", text)
  }

  const activeResult = ranked.find((r) => r.home.id === selectedHomeId)

  return (
    <div className="bg-background text-foreground flex h-svh flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="border-border flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-r p-3 text-sm">
          <div className="border-border space-y-2 border-b pb-3">
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-heading text-base font-semibold tracking-tight leading-snug">
                Jabodetabek Offer Stress-Test
              </h1>
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <Link to="/admin">Admin</Link>
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Pin office + homes · compare commute bands · export a brief
            </p>
          </div>

          <div>
            <p className="mb-1 font-medium">Placement</p>
            <p className="text-muted-foreground text-xs">
              {step === "office" && "Click map to place office"}
              {step === "homes" &&
                `Click to place homes (max ${MAX_HOMES}). Click near a home to move it.`}
              {step === "done" &&
                `${homes.length} home(s). Routes update automatically.`}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant={step === "office" ? "default" : "secondary"}>
                Office
              </Badge>
              <Badge variant={step !== "office" ? "default" : "secondary"}>
                Homes {homes.length}/{MAX_HOMES}
              </Badge>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Office presets</Label>
            <div className="flex flex-wrap gap-1">
              {master.offices.map((o) => (
                <Button
                  key={o.id}
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => placeOfficePreset(o.id)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Home presets</Label>
            <div className="flex flex-wrap gap-1">
              {master.homes.map((h) => (
                <Button
                  key={h.id}
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={homes.length >= MAX_HOMES}
                  onClick={() => addHomePreset(h.id)}
                >
                  {h.label}
                </Button>
              ))}
            </div>
          </div>

          {office && (
            <div className="space-y-1">
              <Label htmlFor={`${formId}-olat`}>Office lat / lng</Label>
              <div className="flex gap-1">
                <Input
                  id={`${formId}-olat`}
                  type="number"
                  step="any"
                  value={office.lat}
                  onChange={(e) =>
                    setOffice({ ...office, lat: Number(e.target.value) })
                  }
                />
                <Input
                  type="number"
                  step="any"
                  value={office.lng}
                  onChange={(e) =>
                    setOffice({ ...office, lng: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}

          {homes.map((h, i) => (
            <div key={h.id} className="space-y-1 rounded-md border p-2">
              <div className="flex items-center justify-between">
                <Label>{h.label}</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    setHomes((prev) => prev.filter((x) => x.id !== h.id))
                  }
                >
                  Remove
                </Button>
              </div>
              <Input
                value={h.label}
                onChange={(e) =>
                  setHomes((prev) =>
                    prev.map((x) =>
                      x.id === h.id ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="any"
                  value={h.lat}
                  onChange={(e) =>
                    setHomes((prev) =>
                      prev.map((x) =>
                        x.id === h.id
                          ? { ...x, lat: Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  step="any"
                  value={h.lng}
                  onChange={(e) =>
                    setHomes((prev) =>
                      prev.map((x) =>
                        x.id === h.id
                          ? { ...x, lng: Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                />
              </div>
              <Label className="text-xs">Rent / mo (optional)</Label>
              <Input
                type="number"
                value={h.rentIdr ?? ""}
                placeholder="0"
                onChange={(e) =>
                  setHomes((prev) =>
                    prev.map((x) =>
                      x.id === h.id
                        ? {
                            ...x,
                            rentIdr: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }
                        : x,
                    ),
                  )
                }
              />
              <span className="text-muted-foreground text-xs">#{i + 1}</span>
            </div>
          ))}

          <Separator />

          <div className="space-y-1">
            <Label>Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as CommuteMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cheapest">Best price mix</SelectItem>
                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                <SelectItem value="ojek">Ojek</SelectItem>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="transit">Transit only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>WFO days</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={wfoDays}
                onChange={(e) => setWfoDays(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1">
              <Label>Salary (IDR)</Label>
              <Input
                type="number"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Brief name / company</Label>
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <p className="text-muted-foreground text-xs">
            {computing
              ? "Computing commute…"
              : office && homes.length
                ? "Routes update when you place or move pins."
                : "Place office, then a home — commute computes automatically."}
          </p>
          {error && <p className="text-destructive text-xs">{error}</p>}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <Suspense
              fallback={
                <div className="bg-muted/40 absolute inset-0 animate-pulse" />
              }
            >
              <ScenarioMap
                office={office}
                homes={homes}
                transit={transit}
                ptEnabled={ptEnabled}
                selectedPlan={selectedPlan}
                onMapClick={handleMapClick}
              />
            </Suspense>

            <div className="absolute top-2 right-2 flex flex-col gap-1.5">
              <div className="bg-background/90 rounded-md border px-2 py-1 text-xs shadow-sm">
                {step === "office"
                  ? "Step: place office"
                  : `Step: place homes (${homes.length}/${MAX_HOMES})`}
              </div>
              <div className="bg-background/90 space-y-1.5 rounded-md border px-2 py-1.5 text-xs shadow-sm">
                <p className="text-muted-foreground font-medium">PT layers</p>
                {TRANSIT_SYSTEMS.map((id) => (
                  <label key={id} className="flex items-center gap-2">
                    <Checkbox
                      checked={ptEnabled[id]}
                      onCheckedChange={(c) =>
                        setPtEnabled((prev) => ({ ...prev, [id]: !!c }))
                      }
                    />
                    <span style={{ color: TRANSIT_COLORS[id] }}>
                      {transit.find((t) => t.id === id)?.label ?? id}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <section className="border-border max-h-[40%] overflow-y-auto border-t p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Results</h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={!ranked.length}
                  onClick={exportBrief}
                >
                  Export .txt brief
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground mb-2 text-xs">
              P50/P80 and fares are heuristic bands — not live Grab/Google ETAs
              or GTFS.
            </p>

            {!ranked.length && (
              <p className="text-muted-foreground text-sm">
                Place an office and at least one home — results appear automatically.
              </p>
            )}

            {ranked.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="p-1">Home</th>
                      <th className="p-1">P50 / P80</th>
                      <th className="p-1">Mo. hours</th>
                      <th className="p-1">Transport</th>
                      <th className="p-1">Rent</th>
                      <th className="p-1">Total</th>
                      <th className="p-1">% salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((r) => (
                      <tr
                        key={r.home.id}
                        className={`hover:bg-muted/50 cursor-pointer border-b ${
                          selectedHomeId === r.home.id ? "bg-muted" : ""
                        }`}
                        onClick={() => {
                          setSelectedHomeId(r.home.id)
                          setSelectedPlan(r.primary)
                        }}
                      >
                        <td className="p-1 font-medium">{r.home.label}</td>
                        <td className="p-1">
                          {r.primary.p50Minutes} / {r.primary.p80Minutes} min
                        </td>
                        <td className="p-1">{r.primary.monthlyHours}</td>
                        <td className="p-1">
                          {formatIdr(r.primary.monthlyCostIdr)}
                        </td>
                        <td className="p-1">
                          {r.rentIdr ? formatIdr(r.rentIdr) : "—"}
                        </td>
                        <td className="p-1">{formatIdr(r.totalMonthlyIdr)}</td>
                        <td className="p-1">{r.pctSalary.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeResult && activeResult.plans.length > 0 && (
              <div className="mt-3 space-y-2">
                <Label>Plans for {activeResult.home.label}</Label>
                <div className="flex flex-wrap gap-1">
                  {activeResult.plans.map((p) => (
                    <Button
                      key={p.signature + p.label}
                      size="sm"
                      variant={
                        selectedPlan?.signature === p.signature &&
                        selectedPlan?.label === p.label
                          ? "default"
                          : "outline"
                      }
                      type="button"
                      onClick={() => setSelectedPlan(p)}
                    >
                      {p.label} · {p.oneWayMinutes}m ·{" "}
                      {formatIdr(p.oneWayCostIdr)}
                    </Button>
                  ))}
                </div>
                {selectedPlan && (
                  <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
                    {selectedPlan.legs.map((leg, i) => (
                      <li key={i}>
                        <span
                          className="mr-1 inline-block size-2 rounded-full"
                          style={{
                            background: TRANSIT_COLORS[
                              leg.kind as TransitSystem
                            ]
                              ? TRANSIT_COLORS[leg.kind as TransitSystem]
                              : leg.kind === "gojek"
                                ? "#22c55e"
                                : "#64748b",
                          }}
                        />
                        {leg.label} — {Math.round(leg.minutes)} min,{" "}
                        {formatIdr(leg.costIdr)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default MapPage
