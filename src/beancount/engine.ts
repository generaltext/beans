// The double-entry engine. Given parsed entries it: computes each posting's
// weight, validates that every transaction balances (inferring a single elided
// posting the way beancount does), accumulates per-account balances by currency,
// and checks `balance` assertions as of the start of their date.
//
// Balances are kept as simple per-currency sums (inventory without lot/cost-basis
// tracking) — enough for the balance sheet, income statement, and register in
// this first pass. Cost-basis lots are a documented follow-up.

import { Dec, inferTolerance, sumDec } from './decimal'
import type {
  Amount,
  BalanceDirective,
  Entry,
  OpenDirective,
  Posting,
  PriceDirective,
  TransactionDirective,
} from './types'
import { isDirective } from './types'

export interface Problem {
  line: number
  message: string
  severity: 'error' | 'warning'
}

/** Balances keyed by account, then currency. */
export type Balances = Map<string, Map<string, Dec>>

export interface Ledger {
  entries: Entry[]
  transactions: TransactionDirective[]
  options: Record<string, string>
  balances: Balances
  openAccounts: Map<string, OpenDirective>
  accounts: string[] // sorted, every account referenced or opened
  commodities: string[] // sorted
  payees: string[] // sorted distinct payees (for autocomplete)
  prices: PriceDirective[]
  problems: Problem[]
}

function weightOf(p: Posting): Amount | null {
  if (!p.units || p.units.number === null || p.units.currency === null) return null
  const n = p.units.number
  if (p.cost && p.cost.number !== null && p.cost.currency) {
    const number = p.cost.total ? (n.isNeg() ? p.cost.number.neg() : p.cost.number) : n.mul(p.cost.number)
    return { number, currency: p.cost.currency }
  }
  if (p.price) {
    const number = p.price.total ? (n.isNeg() ? p.price.number.neg() : p.price.number) : n.mul(p.price.number)
    return { number, currency: p.price.currency }
  }
  return { number: n, currency: p.units.currency }
}

function addTo(map: Map<string, Dec>, currency: string, amount: Dec) {
  map.set(currency, (map.get(currency) ?? Dec.ZERO).add(amount))
}

/** Validate a transaction, filling a single elided posting in place. Returns any
 *  problems found (unbalanced, ambiguous inference). */
function balanceTransaction(txn: TransactionDirective): Problem[] {
  const problems: Problem[] = []
  if (txn.postings.length < 2) {
    problems.push({ line: txn.startLine, message: `Transaction has fewer than two postings`, severity: 'error' })
    return problems
  }

  const elided = txn.postings.filter((p) => !p.units || p.units.number === null)
  if (elided.length > 1) {
    problems.push({
      line: txn.startLine,
      message: `Transaction has more than one posting without an amount`,
      severity: 'error',
    })
    return problems
  }

  // Sum weights of the explicit postings by currency.
  const residual = new Map<string, Dec>()
  const scales: number[] = []
  for (const p of txn.postings) {
    const w = weightOf(p)
    if (!w) continue
    addTo(residual, w.currency, w.number)
    scales.push(w.number.scale)
  }
  const tolerance = inferTolerance(scales)

  if (elided.length === 1) {
    const nonZero = [...residual.entries()].filter(([, v]) => !v.isZero())
    if (nonZero.length === 0) {
      problems.push({ line: txn.startLine, message: `Cannot infer amount: transaction already balances`, severity: 'error' })
      return problems
    }
    if (nonZero.length > 1) {
      problems.push({
        line: txn.startLine,
        message: `Cannot infer elided posting across multiple currencies (${nonZero.map(([c]) => c).join(', ')})`,
        severity: 'error',
      })
      return problems
    }
    const [currency, sum] = nonZero[0]!
    elided[0]!.units = { number: sum.neg(), currency }
    return problems
  }

  // No elided posting: every currency must net to ~zero.
  for (const [currency, sum] of residual) {
    if (!sum.withinTolerance(tolerance)) {
      problems.push({
        line: txn.startLine,
        message: `Transaction does not balance: ${sum.toString()} ${currency} left over`,
        severity: 'error',
      })
    }
  }
  return problems
}

export function realize(entries: Entry[], options: Record<string, string> = {}): Ledger {
  const problems: Problem[] = []
  const transactions: TransactionDirective[] = []
  const openAccounts = new Map<string, OpenDirective>()
  const accountSet = new Set<string>()
  const commoditySet = new Set<string>()
  const payeeSet = new Set<string>()
  const prices: PriceDirective[] = []

  for (const e of entries) {
    if (e.type === 'open') {
      openAccounts.set(e.account, e)
      accountSet.add(e.account)
      for (const c of e.currencies) commoditySet.add(c)
    } else if (e.type === 'commodity') {
      commoditySet.add(e.currency)
    } else if (e.type === 'price') {
      prices.push(e)
      commoditySet.add(e.currency)
      commoditySet.add(e.amount.currency)
    } else if (e.type === 'transaction') {
      transactions.push(e)
      if (e.payee) payeeSet.add(e.payee)
    }
  }

  // Validate + infer each transaction (mutates elided postings).
  for (const txn of transactions) {
    problems.push(...balanceTransaction(txn))
    for (const p of txn.postings) {
      accountSet.add(p.account)
      if (p.units?.currency) commoditySet.add(p.units.currency)
    }
  }

  // Running balances, with balance assertions checked at start-of-day. We order
  // entries by date, placing balance directives before same-day transactions so a
  // `balance` reflects only strictly-earlier activity (beancount semantics).
  const balances: Balances = new Map()
  const accBal = (acc: string) => {
    let m = balances.get(acc)
    if (!m) balances.set(acc, (m = new Map()))
    return m
  }

  const dated = entries.filter(isDirective)
  const order = (t: string) => (t === 'balance' ? 0 : t === 'transaction' ? 1 : 2)
  const sorted = [...dated].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : order(a.type) - order(b.type)))

  for (const e of sorted) {
    if (e.type === 'transaction') {
      for (const p of e.postings) {
        if (p.units && p.units.number !== null && p.units.currency !== null) {
          addTo(accBal(p.account), p.units.currency, p.units.number)
        }
      }
    } else if (e.type === 'balance') {
      const problem = checkBalance(e, accBal(e.account).get(e.amount.currency) ?? Dec.ZERO)
      if (problem) problems.push(problem)
    }
  }

  return {
    entries,
    transactions,
    options,
    balances,
    openAccounts,
    accounts: [...accountSet].sort(),
    commodities: [...commoditySet].sort(),
    payees: [...payeeSet].sort(),
    prices,
    problems,
  }
}

/** Sum posting units per account/currency across transactions, optionally within
 *  a date range. Used by the reports and dashboard for as-of and period views.
 *  `from`/`to` are inclusive ISO dates. */
export function balancesFromTransactions(
  txns: TransactionDirective[],
  range: { from?: string | null; to?: string | null } = {},
): Balances {
  const balances: Balances = new Map()
  for (const t of txns) {
    if (range.from && t.date < range.from) continue
    if (range.to && t.date > range.to) continue
    for (const p of t.postings) {
      if (p.units && p.units.number !== null && p.units.currency !== null) {
        let m = balances.get(p.account)
        if (!m) balances.set(p.account, (m = new Map()))
        m.set(p.units.currency, (m.get(p.units.currency) ?? Dec.ZERO).add(p.units.number))
      }
    }
  }
  return balances
}

function checkBalance(e: BalanceDirective, actual: Dec): Problem | null {
  const tol = e.tolerance ?? inferTolerance([e.amount.number.scale])
  const diff = actual.sub(e.amount.number)
  if (diff.withinTolerance(tol)) return null
  return {
    line: e.startLine,
    message: `Balance assertion failed for ${e.account}: expected ${e.amount.number.toString()} ${e.amount.currency}, got ${actual.toString()} (off by ${diff.toString()})`,
    severity: 'error',
  }
}
