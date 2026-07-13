import { describe, expect, it } from 'vitest'
import { Dec } from './decimal'
import { parse } from './parse'
import { realize } from './engine'
import { buildTree, sumRoots } from './reports'
import { incomeExpenseByInterval, netWorthByInterval, categoryBreakdown } from './series'
import { appendEntry, formatTransaction, removeLines } from './print'
import { SAMPLE_LEDGER, TINY_LEDGER } from './sample'

const tiny = () => realize(parse(TINY_LEDGER).entries, parse(TINY_LEDGER).options)

describe('Dec', () => {
  it('adds without float error', () => {
    expect(Dec.parse('0.1')!.add(Dec.parse('0.2')!).toString()).toBe('0.3')
  })
  it('parses thousands separators', () => {
    expect(Dec.parse('1,234.50')!.toString()).toBe('1234.50')
  })
  it('negates and detects zero', () => {
    expect(Dec.parse('100')!.neg().toString()).toBe('-100')
    expect(Dec.parse('5')!.sub(Dec.parse('5')!).isZero()).toBe(true)
  })
  it('rounds half up in toFixed', () => {
    expect(Dec.parse('2.345')!.toFixed(2)).toBe('2.35')
  })
})

describe('parse', () => {
  it('parses the tiny fixture cleanly', () => {
    const { entries, errors } = parse(TINY_LEDGER)
    expect(errors).toEqual([])
    expect(entries.filter((e) => e.type === 'open')).toHaveLength(7)
  })

  it('captures payee, narration, and tags', () => {
    const { entries } = parse(TINY_LEDGER)
    const txn = entries.find((e) => e.type === 'transaction' && e.payee === 'Stripe')
    expect(txn).toBeTruthy()
    if (txn && txn.type === 'transaction') {
      expect(txn.narration).toBe('Client invoice #1042')
      expect(txn.tags).toContain('consulting')
      expect(txn.postings).toHaveLength(2)
    }
  })

  it('parses the rich sample with no errors and many transactions', () => {
    const { entries, errors } = parse(SAMPLE_LEDGER)
    expect(errors).toEqual([])
    expect(entries.filter((e) => e.type === 'transaction').length).toBeGreaterThan(100)
  })

  it('records source spans', () => {
    for (const e of parse(SAMPLE_LEDGER).entries) expect(e.endLine).toBeGreaterThanOrEqual(e.startLine)
  })
})

describe('engine', () => {
  it('realizes the rich sample with no problems (assertions hold)', () => {
    const { entries, options } = parse(SAMPLE_LEDGER)
    expect(realize(entries, options).problems).toEqual([])
  })

  it('infers the elided posting', () => {
    const opening = tiny().transactions.find((t) => t.narration === 'Opening balance')!
    const equity = opening.postings.find((p) => p.account.startsWith('Equity'))!
    expect(equity.units?.number?.toString()).toBe('-10000.00')
  })

  it('computes final balances', () => {
    expect(tiny().balances.get('Assets:Checking')?.get('USD')?.toString()).toBe('14500.00')
  })

  it('passes a good balance assertion, flags a wrong one', () => {
    expect(tiny().problems).toEqual([])
    const bad = realize(parse(TINY_LEDGER.replace('14500.00 USD', '99999.00 USD')).entries)
    expect(bad.problems.some((p) => /Balance assertion failed/.test(p.message))).toBe(true)
  })

  it('flags an unbalanced transaction', () => {
    const src = `2025-01-01 open Assets:Cash USD
2025-01-01 open Expenses:Foo USD

2025-01-02 * "Bad"
  Assets:Cash      100.00 USD
  Expenses:Foo     -90.00 USD
`
    expect(realize(parse(src).entries).problems.some((p) => /does not balance/.test(p.message))).toBe(true)
  })

  it('collects accounts, commodities, payees', () => {
    const l = tiny()
    expect(l.accounts).toContain('Assets:Checking')
    expect(l.commodities).toContain('USD')
    expect(l.payees).toContain('Stripe')
  })
})

describe('reports', () => {
  it('builds a tree and sums roots', () => {
    const tree = buildTree(tiny().balances)
    // checking 14500 + cash -64.30 = 14435.70
    expect(sumRoots(tree, ['Assets']).get('USD')?.toFixed(2)).toBe('14435.70')
  })
})

describe('series', () => {
  const sample = () => realize(parse(SAMPLE_LEDGER).entries, parse(SAMPLE_LEDGER).options)

  it('buckets income/expense by month across the full 3 years', () => {
    const monthly = incomeExpenseByInterval(sample().transactions, 'USD', 'month')
    expect(monthly).toHaveLength(36)
    for (const m of monthly) {
      expect(m.income).toBeGreaterThan(0)
      expect(m.expenses).toBeGreaterThan(0)
    }
  })

  it('buckets by quarter and year too', () => {
    const txns = sample().transactions
    expect(incomeExpenseByInterval(txns, 'USD', 'quarter')).toHaveLength(12)
    expect(incomeExpenseByInterval(txns, 'USD', 'year')).toHaveLength(3)
  })

  it('respects a date range', () => {
    const txns = sample().transactions
    const yr = incomeExpenseByInterval(txns, 'USD', 'month', { from: '2024-01-01', to: '2024-12-31' })
    expect(yr).toHaveLength(12)
    expect(yr.every((m) => m.bucket.startsWith('2024'))).toBe(true)
  })

  it('net worth trends upward over the years', () => {
    const nw = netWorthByInterval(sample().transactions, 'USD', 'year')
    expect(nw.length).toBe(3)
    expect(nw[nw.length - 1]!.netWorth).toBeGreaterThan(nw[0]!.netWorth)
  })

  it('breaks down expenses by category, sorted descending', () => {
    const cats = categoryBreakdown(sample().balances, 'Expenses', 'USD')
    expect(cats.length).toBeGreaterThan(3)
    expect(cats.map((c) => c.label)).toContain('Payroll')
    for (let i = 1; i < cats.length; i++) expect(cats[i - 1]!.amount).toBeGreaterThanOrEqual(cats[i]!.amount)
  })
})

describe('print / range edits', () => {
  it('formats a transaction that re-parses identically', () => {
    const text = formatTransaction({
      date: '2025-02-01',
      flag: '*',
      payee: 'Stripe',
      narration: 'Invoice #2',
      tags: ['consulting'],
      links: [],
      postings: [
        { account: 'Assets:Checking', number: Dec.parse('1200.00'), currency: 'USD' },
        { account: 'Income:Consulting', number: null, currency: 'USD' },
      ],
    })
    const { entries, errors } = parse(text)
    expect(errors).toEqual([])
    const txn = entries[0]
    expect(txn?.type).toBe('transaction')
    if (txn?.type === 'transaction') {
      expect(txn.payee).toBe('Stripe')
      expect(txn.postings).toHaveLength(2)
    }
  })

  it('append then remove restores the original entry count', () => {
    const base = TINY_LEDGER
    const added = appendEntry(
      base,
      formatTransaction({
        date: '2025-02-01',
        flag: '*',
        payee: 'X',
        narration: 'Y',
        tags: [],
        links: [],
        postings: [
          { account: 'Assets:Cash', number: Dec.parse('5.00'), currency: 'USD' },
          { account: 'Expenses:Office', number: null, currency: 'USD' },
        ],
      }),
    )
    const before = parse(base).entries.length
    const withNew = parse(added)
    expect(withNew.entries.length).toBe(before + 1)
    const last = withNew.entries[withNew.entries.length - 1]!
    const removed = removeLines(added, last.startLine, last.endLine)
    expect(parse(removed).entries.length).toBe(before)
  })
})
