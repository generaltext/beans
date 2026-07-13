// Time-range filtering for the reports and dashboard, à la Fava's time filter.
// Ranges are derived from the DATA (the latest transaction date), not the wall
// clock, so "This year" / "Last 12 months" are meaningful for any ledger — a
// historical demo included — and we never touch Date.now.

import type { TransactionDirective } from '~/beancount'

export interface DateRange {
  id: string
  label: string
  from: string | null // inclusive ISO, null = open start
  to: string | null // inclusive ISO, null = open end
}

export const ALL_TIME: DateRange = { id: 'all', label: 'All time', from: null, to: null }

function latestDate(txns: TransactionDirective[]): string | null {
  let max: string | null = null
  for (const t of txns) if (!max || t.date > max) max = t.date
  return max
}

function distinctYears(txns: TransactionDirective[]): string[] {
  const s = new Set<string>()
  for (const t of txns) s.add(t.date.slice(0, 4))
  return [...s].sort((a, b) => (a < b ? 1 : -1)) // newest first
}

/** Preset ranges for the filter bar, built from the ledger's own dates. */
export function presetRanges(txns: TransactionDirective[]): DateRange[] {
  const presets: DateRange[] = [ALL_TIME]
  const latest = latestDate(txns)
  if (latest) {
    const y = latest.slice(0, 4)
    presets.push({ id: 'ytd', label: `${y} to date`, from: `${y}-01-01`, to: latest })
    const from12 = shiftMonths(latest, -12)
    presets.push({ id: 'last12', label: 'Last 12 months', from: from12, to: latest })
  }
  for (const y of distinctYears(txns)) {
    presets.push({ id: `y${y}`, label: y, from: `${y}-01-01`, to: `${y}-12-31` })
  }
  return presets
}

/** Shift an ISO date by whole months (clamped to day 01 to stay valid). */
function shiftMonths(iso: string, months: number): string {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-01`
}

export function txnInRange(t: TransactionDirective, r: DateRange): boolean {
  if (r.from && t.date < r.from) return false
  if (r.to && t.date > r.to) return false
  return true
}
