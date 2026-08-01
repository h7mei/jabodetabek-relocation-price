import { formatIdr } from "@/lib/commute"
import type { CommuteMode, Pin, RankedHomeResult } from "@/types"

const MODE_LABEL: Record<CommuteMode, string> = {
  cheapest: "Best price mix",
  motorcycle: "Motorcycle",
  ojek: "Ojek",
  car: "Car",
  transit: "Transit only",
}

export function buildDecisionBrief(opts: {
  candidateName?: string
  company?: string
  office: Pin
  mode: CommuteMode
  wfoDays: number
  salaryIdr: number
  ranked: RankedHomeResult[]
}): string {
  const lines: string[] = []
  lines.push("Jabodetabek Offer Stress-Test — Decision Brief")
  lines.push("=".repeat(48))
  lines.push("")
  if (opts.candidateName) lines.push(`Candidate: ${opts.candidateName}`)
  if (opts.company) lines.push(`Company / offer: ${opts.company}`)
  lines.push(
    `Office: ${opts.office.label} (${opts.office.lat.toFixed(5)}, ${opts.office.lng.toFixed(5)})`
  )
  lines.push(`Mode: ${MODE_LABEL[opts.mode]}`)
  lines.push(`WFO days / week: ${opts.wfoDays}`)
  lines.push(`Salary (monthly): ${formatIdr(opts.salaryIdr)}`)
  lines.push("")
  lines.push("Ranked homes")
  lines.push("-".repeat(48))

  opts.ranked.forEach((r, i) => {
    const p = r.primary
    lines.push("")
    lines.push(`${i + 1}. ${r.home.label}`)
    lines.push(`   P50 one-way: ${p.p50Minutes} min | P80: ${p.p80Minutes} min`)
    lines.push(
      `   Transport: ${formatIdr(p.monthlyCostIdr)}/mo (${p.monthlyHours} h) | day RT ${formatIdr(p.dailyRtCostIdr)}`
    )
    if (r.rentIdr > 0) {
      lines.push(`   Rent: ${formatIdr(r.rentIdr)}/mo`)
    }
    lines.push(
      `   Total (transport${r.rentIdr ? "+rent" : ""}): ${formatIdr(r.totalMonthlyIdr)} (~${r.pctSalary.toFixed(1)}% of salary)`
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
  lines.push("Peak road/TJ factor ×1.45; rail and walk are unfactored.")
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  return lines.join("\n")
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
