import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { balancesFromTransactions, buildTree, Dec, sumRoots, type Balances, type TreeNode } from '~/beancount'
import type { LedgerView } from '~/hooks/use-ledger'
import type { DateRange } from '~/lib/filters'
import { fmtAmount } from '~/lib/format'

type Report = 'balance' | 'income' | 'trial'

const REPORTS: { id: Report; label: string }[] = [
  { id: 'balance', label: 'Balance sheet' },
  { id: 'income', label: 'Income statement' },
  { id: 'trial', label: 'Trial balance' },
]

export default function ReportsView({ ledger, range, currency }: { ledger: LedgerView; range: DateRange; currency: string }) {
  const [report, setReport] = useState<Report>('balance')

  const { bs, period } = useMemo(() => {
    const bs = balancesFromTransactions(ledger.transactions, { to: range.to })
    const period = balancesFromTransactions(ledger.transactions, { from: range.from, to: range.to })
    return { bs, period }
  }, [ledger.transactions, range])

  return (
    <div className="w-full p-4 lg:p-6">
      <div className="mb-4 flex items-center gap-1">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setReport(r.id)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              report === r.id
                ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
            }`}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-3 text-xs text-neutral-400">
          {report === 'income'
            ? `for ${range.from ?? 'start'} → ${range.to ?? 'now'}`
            : `as of ${range.to ?? 'now'}`}
        </span>
      </div>

      {report === 'balance' && <BalanceSheet bs={bs} currency={currency} />}
      {report === 'income' && <IncomeStatement period={period} currency={currency} />}
      {report === 'trial' && <TrialBalance bs={bs} currency={currency} />}
    </div>
  )
}

function BalanceSheet({ bs, currency }: { bs: Balances; currency: string }) {
  const tree = buildTree(bs)
  const assets = tree.filter((n) => n.name === 'Assets')
  const liabEquity = tree.filter((n) => n.name === 'Liabilities' || n.name === 'Equity')
  const netWorth = sumRoots(tree, ['Assets', 'Liabilities'])
  if (bs.size === 0) return <Empty />
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Assets" roots={assets} summaryLabel="Total assets" summary={sumRoots(tree, ['Assets'])} />
      <div className="space-y-4">
        <Panel title="Liabilities & equity" roots={liabEquity} summaryLabel="Total" summary={sumRoots(tree, ['Liabilities', 'Equity'])} />
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Net worth</span>
          <Amounts map={netWorth} bold />
        </div>
      </div>
    </div>
  )
}

function IncomeStatement({ period, currency }: { period: Balances; currency: string }) {
  const tree = buildTree(period)
  const income = tree.filter((n) => n.name === 'Income')
  const expenses = tree.filter((n) => n.name === 'Expenses')
  const net = negate(sumRoots(tree, ['Income', 'Expenses']))
  if (income.length === 0 && expenses.length === 0) return <Empty />
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Income" roots={income} summaryLabel="Total income" summary={negate(sumRoots(tree, ['Income']))} />
      <div className="space-y-4">
        <Panel title="Expenses" roots={expenses} summaryLabel="Total expenses" summary={sumRoots(tree, ['Expenses'])} />
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Net income</span>
          <Amounts map={net} bold />
        </div>
      </div>
    </div>
  )
}

function TrialBalance({ bs, currency }: { bs: Balances; currency: string }) {
  const rows = [...bs.entries()]
    .map(([account, byCur]) => ({ account, amount: byCur.get(currency) ?? Dec.ZERO }))
    .filter((r) => !r.amount.isZero())
    .sort((a, b) => a.account.localeCompare(b.account))
  const total = rows.reduce((s, r) => s.add(r.amount), Dec.ZERO)
  if (rows.length === 0) return <Empty />
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-400 dark:border-neutral-800">
            <th className="px-4 py-2 font-medium">Account</th>
            <th className="px-4 py-2 text-right font-medium">Debit</th>
            <th className="px-4 py-2 text-right font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.account} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900">
              <td className="px-4 py-1.5 font-mono text-[13px] text-neutral-700 dark:text-neutral-300">{r.account}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{!r.amount.isNeg() ? fmtAmount(r.amount, currency) : ''}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{r.amount.isNeg() ? fmtAmount(r.amount.neg(), currency) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-300 font-semibold dark:border-neutral-700">
            <td className="px-4 py-2">Total (should be 0)</td>
            <td colSpan={2} className="px-4 py-2 text-right tabular-nums">
              {fmtAmount(total, currency)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ---- shared ----

function negate(m: Map<string, Dec>): Map<string, Dec> {
  const out = new Map<string, Dec>()
  for (const [k, v] of m) out.set(k, v.neg())
  return out
}

function Panel({ title, roots, summaryLabel, summary }: { title: string; roots: TreeNode[]; summaryLabel: string; summary: Map<string, Dec> }) {
  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <header className="border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      <div className="px-2 py-2">
        {roots.length === 0 ? (
          <p className="px-2 py-3 text-sm text-neutral-400">Nothing here.</p>
        ) : (
          roots.map((r) => <Row key={r.account} node={r} depth={0} defaultOpen />)
        )}
      </div>
      <footer className="flex items-center justify-between border-t border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{summaryLabel}</span>
        <Amounts map={summary} bold />
      </footer>
    </section>
  )
}

function Row({ node, depth, defaultOpen = false }: { node: TreeNode; depth: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const hasChildren = node.children.length > 0
  return (
    <div>
      <div className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-neutral-50 dark:hover:bg-neutral-900" style={{ paddingLeft: depth * 16 + 4 }}>
        <button
          onClick={() => hasChildren && setOpen((o) => !o)}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-neutral-400 ${hasChildren ? '' : 'invisible'}`}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <span className={`min-w-0 flex-1 truncate text-sm ${depth === 0 ? 'font-semibold' : ''}`}>{node.name}</span>
        <Amounts map={node.total} muted={hasChildren && open} />
      </div>
      {open && node.children.map((c) => <Row key={c.account} node={c} depth={depth + 1} />)}
    </div>
  )
}

function Amounts({ map, bold, muted }: { map: Map<string, Dec>; bold?: boolean; muted?: boolean }) {
  const items = [...map].filter(([, v]) => !v.isZero()).sort((a, b) => a[0].localeCompare(b[0]))
  if (items.length === 0) return <span className="text-sm text-neutral-400 tabular-nums">0</span>
  return (
    <span className={`shrink-0 text-right text-sm tabular-nums ${bold ? 'font-semibold' : ''} ${muted ? 'text-neutral-400 dark:text-neutral-600' : ''}`}>
      {items.map(([cur, v]) => (
        <span key={cur} className={`block ${v.isNeg() && !muted ? 'text-rose-600 dark:text-rose-400' : ''}`}>
          {fmtAmount(v, cur)}
        </span>
      ))}
    </span>
  )
}

function Empty() {
  return <div className="flex h-40 items-center justify-center text-sm text-neutral-400">No balances in this period.</div>
}
