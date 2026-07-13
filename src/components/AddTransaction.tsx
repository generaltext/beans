import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Dec, type TransactionDraft } from '~/beancount'
import type { LedgerView } from '~/hooks/use-ledger'
import { fmtAmount } from '~/lib/format'

interface Row {
  account: string
  amount: string
  currency: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AddTransaction({
  ledger,
  onAdd,
  onClose,
}: {
  ledger: LedgerView
  onAdd: (draft: TransactionDraft) => void
  onClose: () => void
}) {
  const defaultCurrency = ledger.options['operating_currency'] || ledger.commodities[0] || 'USD'
  const [date, setDate] = useState(today)
  const [payee, setPayee] = useState('')
  const [narration, setNarration] = useState('')
  const [tags, setTags] = useState('')
  const [rows, setRows] = useState<Row[]>([
    { account: '', amount: '', currency: defaultCurrency },
    { account: '', amount: '', currency: defaultCurrency },
  ])
  const [error, setError] = useState<string | null>(null)

  const filled = rows.filter((r) => r.account.trim())

  // Live balance check across the entered postings (single-currency case).
  const residual = useMemo(() => {
    const byCur = new Map<string, Dec>()
    let blanks = 0
    for (const r of filled) {
      if (r.amount.trim() === '') {
        blanks++
        continue
      }
      const n = Dec.parse(r.amount)
      if (!n) continue
      byCur.set(r.currency, (byCur.get(r.currency) ?? Dec.ZERO).add(n))
    }
    return { byCur, blanks }
  }, [filled])

  const nonZero = [...residual.byCur].filter(([, v]) => !v.isZero())
  const balanced = residual.blanks === 0 && nonZero.length === 0
  const willInfer = residual.blanks === 1 && nonZero.length === 1

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function submit() {
    setError(null)
    if (filled.length < 2) return setError('A transaction needs at least two postings.')
    const blanks = filled.filter((r) => r.amount.trim() === '')
    if (blanks.length > 1) return setError('At most one posting can be left blank (to infer).')
    for (const r of filled) {
      if (r.amount.trim() !== '' && !Dec.parse(r.amount)) return setError(`"${r.amount}" is not a number.`)
    }
    const draft: TransactionDraft = {
      date,
      flag: '*',
      payee: payee.trim() || null,
      narration: narration.trim(),
      tags: tags.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean),
      links: [],
      postings: filled.map((r) => ({
        account: r.account.trim(),
        number: r.amount.trim() === '' ? null : Dec.parse(r.amount),
        currency: r.currency.trim() || defaultCurrency,
      })),
    }
    onAdd(draft)
    // reset the money-bearing fields, keep date/currency for fast entry
    setPayee('')
    setNarration('')
    setTags('')
    setRows([
      { account: '', amount: '', currency: defaultCurrency },
      { account: '', amount: '', currency: defaultCurrency },
    ])
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      <datalist id="beans-accounts">
        {ledger.accounts.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">New transaction</h3>
        <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800">
          <X size={14} />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Payee">
          <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Stripe" className={inputCls} />
        </Field>
        <Field label="Narration" className="col-span-2">
          <input
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Client invoice #1042"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              list="beans-accounts"
              value={r.account}
              onChange={(e) => setRow(i, { account: e.target.value })}
              placeholder="Assets:Checking"
              className={`${inputCls} flex-1`}
            />
            <input
              value={r.amount}
              onChange={(e) => setRow(i, { amount: e.target.value })}
              placeholder="0.00"
              inputMode="decimal"
              className={`${inputCls} w-28 text-right tnum`}
            />
            <input
              value={r.currency}
              onChange={(e) => setRow(i, { currency: e.target.value.toUpperCase() })}
              className={`${inputCls} w-16 uppercase`}
            />
            <button
              onClick={() => setRows((rs) => (rs.length > 2 ? rs.filter((_, idx) => idx !== i) : rs))}
              disabled={rows.length <= 2}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-200 disabled:opacity-30 dark:hover:bg-neutral-800"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRows((rs) => [...rs, { account: '', amount: '', currency: defaultCurrency }])}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            <Plus size={13} /> Add posting
          </button>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="#tags"
            className={`${inputCls} w-32`}
          />
        </div>
        <div className="flex items-center gap-3">
          <BalanceHint balanced={balanced} willInfer={willInfer} residual={nonZero} blanks={residual.blanks} />
          <button
            onClick={submit}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
          >
            Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}

function BalanceHint({
  balanced,
  willInfer,
  residual,
  blanks,
}: {
  balanced: boolean
  willInfer: boolean
  residual: [string, Dec][]
  blanks: number
}) {
  if (balanced) return <span className="text-xs text-emerald-600 dark:text-emerald-400">Balanced</span>
  if (willInfer && residual[0])
    return (
      <span className="text-xs text-neutral-500 tnum">
        will infer {fmtAmount(residual[0][1].neg(), residual[0][0])}
      </span>
    )
  if (blanks > 1) return <span className="text-xs text-rose-500">too many blanks</span>
  return (
    <span className="text-xs text-amber-600 tnum dark:text-amber-400">
      off by {residual.map(([c, v]) => fmtAmount(v, c)).join(', ') || '—'}
    </span>
  )
}

const inputCls =
  'rounded border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-0.5 ${className ?? ''}`}>
      <span className="text-[10px] uppercase tracking-wider text-neutral-400">{label}</span>
      {children}
    </label>
  )
}
