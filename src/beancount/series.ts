// Time-series aggregations for the dashboard. beancount balances are exact
// decimals; charts only need approximate `number`s, so we convert at the edge
// (toNumber) and keep the aggregation in Dec. Everything is computed for a single
// currency (the operating currency) — multi-currency charts are a follow-up.

import { Dec } from './decimal'
import type { Balances } from './engine'
import type { TransactionDirective } from './types'

export type Interval = 'month' | 'quarter' | 'year'

export interface IntervalPoint {
  bucket: string // sortable key (YYYY-MM, YYYY-Qn, YYYY)
  label: string
  income: number // revenue, positive
  expenses: number
  net: number
}

export interface NetWorthPoint {
  bucket: string
  label: string
  netWorth: number
}

export interface CategoryAmount {
  account: string
  label: string
  amount: number
}

const rootOf = (account: string) => account.split(':')[0] ?? ''

export function bucketKey(date: string, interval: Interval): string {
  const y = date.slice(0, 4)
  const m = date.slice(5, 7)
  if (interval === 'year') return y
  if (interval === 'quarter') return `${y}-Q${Math.floor((Number(m) - 1) / 3) + 1}`
  return `${y}-${m}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function bucketLabel(bucket: string, interval: Interval): string {
  if (interval === 'year') return bucket
  if (interval === 'quarter') {
    const [y, q] = bucket.split('-')
    return `${q} '${y!.slice(2)}`
  }
  const [y, m] = bucket.split('-')
  return `${MONTHS[Number(m) - 1]} '${y!.slice(2)}`
}

function inRange(date: string, range?: { from?: string | null; to?: string | null }) {
  if (!range) return true
  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

/** Revenue vs expenses (and net) per interval bucket, one currency. */
export function incomeExpenseByInterval(
  txns: TransactionDirective[],
  currency: string,
  interval: Interval,
  range?: { from?: string | null; to?: string | null },
): IntervalPoint[] {
  const map = new Map<string, { income: Dec; expenses: Dec }>()
  for (const t of txns) {
    if (!inRange(t.date, range)) continue
    for (const p of t.postings) {
      if (!p.units?.number || p.units.currency !== currency) continue
      const root = rootOf(p.account)
      if (root !== 'Income' && root !== 'Expenses') continue
      const b = bucketKey(t.date, interval)
      let e = map.get(b)
      if (!e) map.set(b, (e = { income: Dec.ZERO, expenses: Dec.ZERO }))
      if (root === 'Income') e.income = e.income.add(p.units.number)
      else e.expenses = e.expenses.add(p.units.number)
    }
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([bucket, { income, expenses }]) => {
      const revenue = income.neg()
      return {
        bucket,
        label: bucketLabel(bucket, interval),
        income: revenue.toNumber(),
        expenses: expenses.toNumber(),
        net: revenue.sub(expenses).toNumber(),
      }
    })
}

/** Cumulative net worth (Assets + Liabilities) at each interval end. Computed over
 *  ALL history (so cumulative is correct); filter the result to a display range
 *  after the fact. */
export function netWorthByInterval(
  txns: TransactionDirective[],
  currency: string,
  interval: Interval,
): NetWorthPoint[] {
  const delta = new Map<string, Dec>()
  const buckets = new Set<string>()
  for (const t of txns) {
    const b = bucketKey(t.date, interval)
    buckets.add(b)
    for (const p of t.postings) {
      if (!p.units?.number || p.units.currency !== currency) continue
      const root = rootOf(p.account)
      if (root !== 'Assets' && root !== 'Liabilities') continue
      delta.set(b, (delta.get(b) ?? Dec.ZERO).add(p.units.number))
    }
  }
  let running = Dec.ZERO
  return [...buckets].sort().map((bucket) => {
    running = running.add(delta.get(bucket) ?? Dec.ZERO)
    return { bucket, label: bucketLabel(bucket, interval), netWorth: running.toNumber() }
  })
}

/** Top categories under a root (e.g. Expenses) aggregated at `depth` segments. */
export function categoryBreakdown(balances: Balances, root: string, currency: string, depth = 2): CategoryAmount[] {
  const agg = new Map<string, Dec>()
  const prefix = root + ':'
  for (const [account, byCur] of balances) {
    if (!account.startsWith(prefix)) continue
    const v = byCur.get(currency)
    if (!v || v.isZero()) continue
    const key = account.split(':').slice(0, depth).join(':')
    agg.set(key, (agg.get(key) ?? Dec.ZERO).add(v))
  }
  return [...agg.entries()]
    .map(([account, v]) => ({ account, label: account.slice(prefix.length), amount: Math.abs(v.toNumber()) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}
