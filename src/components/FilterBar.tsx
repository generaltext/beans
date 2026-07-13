import type { Interval } from '~/beancount'
import type { DateRange } from '~/lib/filters'

// The Fava-style filter bar: a time-range selector (presets derived from the
// ledger's own dates, plus custom from/to) and an interval toggle that buckets
// the time-series charts. Currency is shown for context (single operating
// currency for now).
export default function FilterBar({
  presets,
  range,
  onRange,
  interval,
  onInterval,
  currency,
  showInterval = true,
}: {
  presets: DateRange[]
  range: DateRange
  onRange: (r: DateRange) => void
  interval: Interval
  onInterval: (i: Interval) => void
  currency: string
  showInterval?: boolean
}) {
  const onPreset = (id: string) => {
    const p = presets.find((x) => x.id === id)
    if (p) onRange(p)
  }
  const setFrom = (v: string) => onRange({ id: 'custom', label: 'Custom', from: v || null, to: range.to })
  const setTo = (v: string) => onRange({ id: 'custom', label: 'Custom', from: range.from, to: v || null })

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-200 bg-neutral-50/60 px-4 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
      <span className="font-medium uppercase tracking-wider text-neutral-400">Period</span>
      <select
        value={presets.some((p) => p.id === range.id) ? range.id : 'custom'}
        onChange={(e) => onPreset(e.target.value)}
        className="rounded border border-neutral-300 bg-white px-2 py-1 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
        {range.id === 'custom' && <option value="custom">Custom</option>}
      </select>

      <div className="flex items-center gap-1 text-neutral-500">
        <input
          type="date"
          value={range.from ?? ''}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <span>→</span>
        <input
          type="date"
          value={range.to ?? ''}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {showInterval && (
          <div className="flex items-center gap-1">
            <span className="uppercase tracking-wider text-neutral-400">Interval</span>
            <div className="inline-flex overflow-hidden rounded border border-neutral-300 dark:border-neutral-700">
              {(['month', 'quarter', 'year'] as Interval[]).map((i) => (
                <button
                  key={i}
                  onClick={() => onInterval(i)}
                  className={`px-2 py-0.5 capitalize ${
                    interval === i
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  {i[0]}
                </button>
              ))}
            </div>
          </div>
        )}
        <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          {currency}
        </span>
      </div>
    </div>
  )
}
