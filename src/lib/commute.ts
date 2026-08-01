import { WEEKS_PER_MONTH } from "@/master/defaults"
import type { FareBand } from "@/types"

export function fareIdr(band: FareBand, meters: number): number {
  const km = meters / 1000
  const billed =
    band.kmCap != null && band.kmCap > 0 ? Math.min(km, band.kmCap) : km
  return Math.round(band.base + billed * band.perKm)
}

export function monthlyFromOneWay(
  oneWayCostIdr: number,
  oneWayMinutes: number,
  wfoDays: number
): { monthlyCostIdr: number; monthlyHours: number; dailyRtCostIdr: number } {
  const dailyRtCostIdr = oneWayCostIdr * 2
  const monthlyCostIdr = Math.round(dailyRtCostIdr * wfoDays * WEEKS_PER_MONTH)
  const monthlyHours = (oneWayMinutes * 2 * wfoDays * WEEKS_PER_MONTH) / 60
  return { monthlyCostIdr, monthlyHours, dailyRtCostIdr }
}

export function pctOfSalary(monthlyIdr: number, salaryIdr: number): number {
  if (salaryIdr <= 0) return 0
  return (monthlyIdr / salaryIdr) * 100
}

export function formatIdr(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n)
}
