import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import { Dec, type TransactionDirective, type TransactionDraft } from '~/beancount'
import type { LedgerView } from '~/hooks/use-ledger'
import type { DateRange } from '~/lib/filters'
import { txnInRange } from '~/lib/filters'
import { fmtAmount } from '~/lib/format'
import AddTransaction from '~/components/AddTransaction'

/** The transaction's "size": the sum of its positive-signed postings by currency
 *  (money in), which is the natural magnitude to show in a register row. */
function magnitude(txn: TransactionDirective): Map<string, Dec> {
  const m = new Map<string, Dec>()
  for (const p of txn.postings) {
    if (p.units?.number && p.units.currency && !p.units.number.isNeg()) {
      m.set(p.units.currency, (m.get(p.units.currency) ?? Dec.ZERO).add(p.units.number))
    }
  }
  return m
}

export default function TransactionsView({
  ledger,
  range,
  onAdd,
  onDelete,
}: {
  ledger: LedgerView
  range: DateRange
  onAdd: (draft: TransactionDraft) => void
  onDelete: (start: number, end: number) => void
}) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Set<number>>(new Set())

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = ledger.transactions.filter((t) => {
      if (!txnInRange(t, range)) return false
      if (!q) return true
      const hay = [t.payee, t.narration, ...t.tags, ...t.postings.map((p) => p.account)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    // newest first; stable within a date
    return list
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : b.i - a.i))
      .map((x) => x.t)
  }, [ledger.transactions, query, range])

  function toggle(line: number) {
    setOpen((s) => {
      const next = new Set(s)
      next.has(line) ? next.delete(line) : next.add(line)
      return next
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search payee, narration, account, #tag…"
            className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {adding && <AddTransaction ledger={ledger} onAdd={onAdd} onClose={() => setAdding(false)} />}

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">
          {ledger.transactions.length === 0 ? 'No transactions yet.' : 'No matches.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          {rows.map((t) => {
            const isOpen = open.has(t.startLine)
            const mag = magnitude(t)
            return (
              <div key={t.startLine} className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-900">
                <div
                  className="group flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  onClick={() => toggle(t.startLine)}
                >
                  <button className="flex h-4 w-4 shrink-0 items-center justify-center text-neutral-400">
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  <span className="w-[5.5rem] shrink-0 text-xs text-neutral-500 tnum">{t.date}</span>
                  {t.flag !== '*' && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      {t.flag}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {t.payee && <span className="font-medium">{t.payee}</span>}
                    {t.payee && t.narration && <span className="text-neutral-400"> · </span>}
                    <span className="text-neutral-600 dark:text-neutral-300">{t.narration}</span>
                    {t.tags.map((tag) => (
                      <span key={tag} className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">
                        #{tag}
                      </span>
                    ))}
                  </span>
                  <span className="shrink-0 text-right text-sm tnum">
                    {[...mag].map(([cur, v]) => (
                      <span key={cur} className="block text-neutral-700 dark:text-neutral-200">
                        {fmtAmount(v, cur)}
                      </span>
                    ))}
                  </span>
                </div>

                {isOpen && (
                  <div className="bg-neutral-50/60 px-3 pb-2 pl-11 dark:bg-neutral-900/40">
                    <table className="w-full text-sm">
                      <tbody>
                        {t.postings.map((p, idx) => (
                          <tr key={idx}>
                            <td className="py-0.5 pr-4 text-neutral-700 dark:text-neutral-300">{p.account}</td>
                            <td
                              className={`py-0.5 text-right tnum ${p.units?.number?.isNeg() ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-700 dark:text-neutral-200'}`}
                            >
                              {p.units?.number && p.units.currency ? fmtAmount(p.units.number, p.units.currency) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-1 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this transaction from the ledger?')) onDelete(t.startLine, t.endLine)
                        }}
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
