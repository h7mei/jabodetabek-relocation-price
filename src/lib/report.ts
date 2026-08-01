import { formatIdr } from "@/lib/commute"
import { COMMUTE_MODE_LABELS, type Pin, type RankedHomeResult } from "@/types"

export function buildDecisionBrief(opts: {
  candidateName?: string
  company?: string
  office: Pin
  wfoDays: number
  ranked: RankedHomeResult[]
  peakFactor?: number
}): string {
  const peak = opts.peakFactor ?? 1.45
  const lines: string[] = []
  lines.push("Jabodetabek Offer Stress-Test — Decision Brief")
  lines.push("=".repeat(48))
  lines.push("")
  if (opts.candidateName) lines.push(`Candidate: ${opts.candidateName}`)
  if (opts.company) lines.push(`Company / offer: ${opts.company}`)
  lines.push(
    `Office: ${opts.office.label} (${opts.office.lat.toFixed(5)}, ${opts.office.lng.toFixed(5)})`
  )
  lines.push(`WFO days / week: ${opts.wfoDays}`)
  lines.push("")
  lines.push("Ranked homes (by monthly transport cost)")
  lines.push("-".repeat(48))

  opts.ranked.forEach((r, i) => {
    const p = r.primary
    lines.push("")
    lines.push(`${i + 1}. ${r.home.label}`)
    lines.push(`   Mode: ${COMMUTE_MODE_LABELS[r.mode]}`)
    lines.push(`   P50 one-way: ${p.p50Minutes} min | P80: ${p.p80Minutes} min`)
    lines.push(
      `   Transport: ${formatIdr(p.monthlyCostIdr)}/mo (${p.monthlyHours} h) | day RT ${formatIdr(p.dailyRtCostIdr)}`
    )
    lines.push(`   Plan: ${p.label}`)
    for (const leg of p.legs) {
      lines.push(
        `     • ${leg.label}: ${Math.round(leg.minutes)} min, ${formatIdr(leg.costIdr)}`
      )
    }
  })

  lines.push("")
  lines.push("Caveats")
  lines.push("-".repeat(48))
  lines.push(
    "Figures are decision-support bands (P50/P80 heuristics and fare estimates),"
  )
  lines.push(
    "not live Grab/Google ETAs, live GTFS schedules, or live ride-hailing quotes."
  )
  lines.push(`Peak road/TJ factor ×${peak}; rail and walk are unfactored.`)
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  return lines.join("\n")
}
