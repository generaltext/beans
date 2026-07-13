import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { isDirective, type Directive } from '~/beancount'
import type { LedgerView } from '~/hooks/use-ledger'
import type { DateRange } from '~/lib/filters'
import { fmtAmount } from '~/lib/format'

// Fava-style Journal: the whole directive stream (transactions, balances, notes,
// prices, opens…), newest first, with a type filter and text search. Read-only —
// editing happens in Transactions or Source.

type Filter = 'all' | 'transaction' | 'balance' | 'note' | 'price' | 'open'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'transaction', label: 'Transactions' },
  { id: 'balance', label: 'Balances' },
  { id: 'note', label: 'Notes' },
  { id: 'price', label: 'Prices' },
  { id: 'open', label: 'Open/close' },
]

const BADGE: Record<string, string> = {
  transaction: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  balance: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  note: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  price: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  open: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  close: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  pad: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800',
  document: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800',
  event: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800',
  commodity: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800',
}

export default function JournalView({ ledger, range }: { ledger: LedgerView; range: DateRange }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ledger.entries
      .filter(isDirective)
      .filter((e) => (!range.from || e.date >= range.from) && (!range.to || e.date <= range.to))
      .filter((e) => (filter === 'all' ? true : filter === 'open' ? e.type === 'open' || e.type === 'close' : e.type === filter))
      .filter((e) => (q ? describe(e).toLowerCase().includes(q) : true))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.startLine - a.startLine))
  }, [ledger.entries, filter, query, range])

  return (
    <div className="w-full space-y-3 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                filter === f.id ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">No entries.</p>
        ) : (
          rows.map((e, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-neutral-100 px-3 py-1.5 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900">
              <span className="w-[5.5rem] shrink-0 text-xs text-neutral-500 tabular-nums">{e.date}</span>
              <span className={`w-24 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium capitalize ${BADGE[e.type] ?? BADGE['transaction']}`}>
                {e.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{describe(e)}</span>
              <span className="shrink-0 text-right text-sm tabular-nums text-neutral-600 dark:text-neutral-300">{amountOf(e)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function describe(e: Directive): string {
  switch (e.type) {
    case 'transaction':
      return [e.flag, e.payee, e.narration, ...e.tags.map((t) => `#${t}`)].filter(Boolean).join(' ')
    case 'balance':
      return `balance ${e.account}`
    case 'note':
      return `${e.account}: ${e.comment}`
    case 'price':
      return `price ${e.currency}`
    case 'open':
      return `open ${e.account}${e.currencies.length ? ` (${e.currencies.join(', ')})` : ''}`
    case 'close':
      return `close ${e.account}`
    case 'pad':
      return `pad ${e.account} from ${e.sourceAccount}`
    case 'document':
      return `${e.account}: ${e.filename}`
    case 'event':
      return `${e.name}: ${e.value}`
    case 'commodity':
      return `commodity ${e.currency}`
    default:
      return ''
  }
}

function amountOf(e: Directive): string {
  if (e.type === 'balance' || e.type === 'price') return fmtAmount(e.amount.number, e.amount.currency)
  if (e.type === 'transaction') {
    const first = e.postings.find((p) => p.units?.number && p.units.currency)
    return first?.units?.number && first.units.currency ? fmtAmount(first.units.number, first.units.currency) : ''
  }
  return ''
}
