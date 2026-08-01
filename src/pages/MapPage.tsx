import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
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
import { formatIdr } from "@/lib/commute"
import { planForMode } from "@/lib/multimodalPlanner"
import { buildDecisionBrief } from "@/lib/report"
import { haversineMeters } from "@/lib/routing"
import { loadTransitCatalog } from "@/lib/transitCatalog"
import { DEFAULT_WFO_DAYS, MOVE_HOME_M } from "@/master/defaults"
import { loadMaster } from "@/master/store"
import {
  COMMUTE_MODE_LABELS,
  COMMUTE_MODES,
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
  const [briefCopied, setBriefCopied] = useState(false)
  const formId = useId()
  const compareGen = useRef(0)
  const briefCopyTimer = useRef<number | null>(null)
  const selectedHomeIdRef = useRef<string | null>(null)
  selectedHomeIdRef.current = selectedHomeId
  const pendingSelectHomeIdRef = useRef<string | null>(null)
  const resultsRef = useRef<HTMLElement>(null)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const lastFocusedHomesKey = useRef("")

  useEffect(() => {
    loadTransitCatalog()
      .then(setTransit)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load transit"),
      )
  }, [])

  // After new home placement finishes computing, put newest row at top of results
  useEffect(() => {
    if (computing || ranked.length === 0 || !selectedHomeId) return
    const key = homes
      .map((h) => `${h.id}:${h.lat.toFixed(5)},${h.lng.toFixed(5)}`)
      .join("|")
    if (!key || key === lastFocusedHomesKey.current) return
    lastFocusedHomesKey.current = key
    const section = resultsRef.current
    const row = rowRefs.current.get(selectedHomeId)
    if (!section) return
    section.scrollIntoView({ behavior: "smooth", block: "nearest" })
    if (row) {
      const sectionTop = section.getBoundingClientRect().top
      const rowTop = row.getBoundingClientRect().top
      section.scrollTop += rowTop - sectionTop - 8
      row.focus({ preventScroll: true })
    } else {
      section.focus({ preventScroll: true })
    }
  }, [computing, ranked, homes, selectedHomeId])

  // Auto-compute whenever office + homes (and inputs) change
  useEffect(() => {
    if (!office || homes.length === 0 || transit.length === 0) {
      setRanked([])
      setSelectedPlan(null)
      setSelectedHomeId(null)
      setComputing(false)
      lastFocusedHomesKey.current = ""
      pendingSelectHomeIdRef.current = null
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
            const mode: CommuteMode = home.mode ?? "cheapest"
            const plans = await planForMode(
              home,
              office,
              mode,
              transit,
              master.pricing,
              master.traffic,
              wfoDays,
            )
            if (gen !== compareGen.current) return
            if (!plans.length) {
              results.push({
                home,
                mode,
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
              })
              continue
            }
            results.push({
              home,
              mode,
              plans,
              primary: plans[0],
            })
          }
          if (gen !== compareGen.current) return
          results.sort(
            (a, b) => a.primary.monthlyCostIdr - b.primary.monthlyCostIdr,
          )
          const preferId = pendingSelectHomeIdRef.current
          pendingSelectHomeIdRef.current = null
          const prevId = selectedHomeIdRef.current
          const row =
            (preferId
              ? results.find((r) => r.home.id === preferId)
              : null) ??
            results.find((r) => r.home.id === prevId) ??
            results[0] ??
            null
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
  }, [office, homes, wfoDays, transit, master.pricing, master.traffic])

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
    const n = homes.length + 1
    const id = uid("home")
    pendingSelectHomeIdRef.current = id
    setHomes((prev) => [
      ...prev,
      {
        id,
        kind: "home",
        label: `Home ${n}`,
        lat,
        lng,
        mode: "cheapest",
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
    const p = master.homes.find((h) => h.id === id)
    if (!p) return
    const homeId = uid("home")
    pendingSelectHomeIdRef.current = homeId
    setHomes((prev) => [
      ...prev,
      {
        id: homeId,
        kind: "home",
        label: p.label,
        lat: p.lat,
        lng: p.lng,
        mode: "cheapest",
      },
    ])
    setStep("done")
  }

  const setHomeMode = (homeId: string, next: CommuteMode) => {
    pendingSelectHomeIdRef.current = homeId
    setHomes((prev) =>
      prev.map((h) => (h.id === homeId ? { ...h, mode: next } : h)),
    )
  }

  const resetScenario = () => {
    compareGen.current += 1
    pendingSelectHomeIdRef.current = null
    lastFocusedHomesKey.current = ""
    setOffice(null)
    setHomes([])
    setStep("office")
    setWfoDays(DEFAULT_WFO_DAYS)
    setName("")
    setCompany("")
    setPtEnabled({
      krl: false,
      mrt: false,
      lrt: false,
      transjakarta: false,
    })
    setRanked([])
    setSelectedHomeId(null)
    setSelectedPlan(null)
    setComputing(false)
    setError(null)
  }

  const copyBrief = async () => {
    if (!office || !ranked.length) return
    const text = buildDecisionBrief({
      candidateName: name || undefined,
      company: company || undefined,
      office,
      wfoDays,
      ranked,
      peakFactor: master.traffic.peakFactor,
    })
    try {
      await navigator.clipboard.writeText(text)
      setBriefCopied(true)
      if (briefCopyTimer.current != null) {
        window.clearTimeout(briefCopyTimer.current)
      }
      briefCopyTimer.current = window.setTimeout(() => {
        setBriefCopied(false)
        briefCopyTimer.current = null
      }, 2000)
    } catch {
      setError("Could not copy brief to clipboard")
    }
  }

  // Newest placement first; cost rank kept for # badges / brief
  const costRankByHomeId = new Map(
    ranked.map((r, i) => [r.home.id, i + 1]),
  )
  const homeOrder = new Map(homes.map((h, i) => [h.id, i]))
  const displayRanked = [...ranked].sort(
    (a, b) =>
      (homeOrder.get(b.home.id) ?? 0) - (homeOrder.get(a.home.id) ?? 0),
  )

  return (
    <div className="bg-background text-foreground flex h-svh flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="border-border flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-r p-3 text-sm">
          <div className="border-border space-y-2 border-b pb-3">
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-heading text-base font-semibold tracking-tight leading-snug">
                Jabodetabek Relocation Price
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
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-medium">Placement</p>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={!office && homes.length === 0 && ranked.length === 0}
                onClick={resetScenario}
              >
                Reset
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {step === "office" && "Click map to place office"}
              {step === "homes" &&
                "Click to place homes. Click near a home to move it."}
              {step === "done" &&
                `${homes.length} home(s). Routes update automatically.`}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant={step === "office" ? "default" : "secondary"}>
                Office
              </Badge>
              <Badge variant={step !== "office" ? "default" : "secondary"}>
                Homes {homes.length}
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

          <Separator />

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
                  : `Step: place homes (${homes.length})`}
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

          <section
            ref={resultsRef}
            tabIndex={-1}
            className="border-border max-h-[40%] overflow-y-auto border-t p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Results</h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={!ranked.length}
                  onClick={() => void copyBrief()}
                >
                  {briefCopied ? "Copied!" : "Copy brief as txt"}
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
                      <th className="p-1">Mode</th>
                      <th className="p-1">P50 / P80</th>
                      <th className="p-1">Mo. hours</th>
                      <th className="p-1">Transport / mo</th>
                      <th className="p-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayRanked.map((r) => {
                      const home = homes.find((h) => h.id === r.home.id) ?? r.home
                      const homeMode = home.mode ?? "cheapest"
                      const costRank = costRankByHomeId.get(r.home.id) ?? 0
                      const isExpanded = selectedHomeId === r.home.id
                      const selectRow = () => {
                        if (selectedHomeId === r.home.id) return
                        setSelectedHomeId(r.home.id)
                        setSelectedPlan(r.primary)
                      }
                      return (
                        <Fragment key={r.home.id}>
                          <tr
                            ref={(el) => {
                              if (el) rowRefs.current.set(r.home.id, el)
                              else rowRefs.current.delete(r.home.id)
                            }}
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            className={`hover:bg-muted/50 cursor-pointer border-b outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                              isExpanded ? "bg-muted" : ""
                            }`}
                            onClick={selectRow}
                            onFocus={selectRow}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                selectRow()
                              }
                            }}
                          >
                            <td className="p-1 align-top">
                              <div
                                className="space-y-1"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <div className="text-muted-foreground text-[10px]">
                                  #{costRank}
                                </div>
                                <Input
                                  className="h-7 min-w-28 text-xs font-medium"
                                  value={home.label}
                                  aria-label={`${home.label} label`}
                                  onChange={(e) =>
                                    setHomes((prev) =>
                                      prev.map((x) =>
                                        x.id === home.id
                                          ? { ...x, label: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                                <div className="flex gap-1">
                                  <Input
                                    className="h-7 text-xs"
                                    type="number"
                                    step="any"
                                    value={home.lat}
                                    aria-label={`${home.label} latitude`}
                                    onChange={(e) =>
                                      setHomes((prev) =>
                                        prev.map((x) =>
                                          x.id === home.id
                                            ? {
                                                ...x,
                                                lat: Number(e.target.value),
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                  <Input
                                    className="h-7 text-xs"
                                    type="number"
                                    step="any"
                                    value={home.lng}
                                    aria-label={`${home.label} longitude`}
                                    onChange={(e) =>
                                      setHomes((prev) =>
                                        prev.map((x) =>
                                          x.id === home.id
                                            ? {
                                                ...x,
                                                lng: Number(e.target.value),
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </td>
                            <td
                              className="p-1 align-middle"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <Select
                                value={homeMode}
                                onValueChange={(v) =>
                                  setHomeMode(home.id, v as CommuteMode)
                                }
                              >
                                <SelectTrigger
                                  className="h-7 min-w-32 text-xs"
                                  aria-label={`${home.label} commute mode`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COMMUTE_MODES.map((m) => (
                                    <SelectItem key={m} value={m}>
                                      {COMMUTE_MODE_LABELS[m]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1 align-middle">
                              {r.primary.p50Minutes} / {r.primary.p80Minutes}{" "}
                              min
                            </td>
                            <td className="p-1 align-middle">
                              {r.primary.monthlyHours}
                            </td>
                            <td className="p-1 align-middle">
                              {formatIdr(r.primary.monthlyCostIdr)}
                            </td>
                            <td
                              className="p-1 align-middle"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  setHomes((prev) =>
                                    prev.filter((x) => x.id !== home.id),
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                          {isExpanded && r.plans.length > 0 && (
                            <tr className="bg-muted/40 border-b">
                              <td colSpan={6} className="p-3">
                                <div className="space-y-2">
                                  <Label>
                                    Recommendations for {home.label}
                                  </Label>
                                  <div className="flex flex-wrap gap-1">
                                    {r.plans.map((p) => (
                                      <Button
                                        key={p.signature + p.label}
                                        size="sm"
                                        variant={
                                          selectedPlan?.signature ===
                                            p.signature &&
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
                                  {selectedPlan &&
                                    selectedHomeId === r.home.id && (
                                      <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
                                        {selectedPlan.legs.map((leg, li) => (
                                          <li key={li}>
                                            <span
                                              className="mr-1 inline-block size-2 rounded-full"
                                              style={{
                                                background: TRANSIT_COLORS[
                                                  leg.kind as TransitSystem
                                                ]
                                                  ? TRANSIT_COLORS[
                                                      leg.kind as TransitSystem
                                                    ]
                                                  : leg.kind === "gojek"
                                                    ? "#22c55e"
                                                    : "#64748b",
                                              }}
                                            />
                                            {leg.label} —{" "}
                                            {Math.round(leg.minutes)} min,{" "}
                                            {formatIdr(leg.costIdr)}
                                          </li>
                                        ))}
                                      </ol>
                                    )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default MapPage
