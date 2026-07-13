import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts'
import {
  balancesFromTransactions,
  buildTree,
  bucketKey,
  categoryBreakdown,
  incomeExpenseByInterval,
  netWorthByInterval,
  sumRoots,
  type CategoryAmount,
  type Interval,
} from '~/beancount'
import type { LedgerView } from '~/hooks/use-ledger'
import type { DateRange } from '~/lib/filters'

// Validated 8-hue categorical set (dataviz reference palette), for treemap cells.
const CATS_LIGHT = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']
const CATS_DARK = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926']

function palette(dark: boolean) {
  return dark
    ? { blue: '#3987e5', orange: '#d95926', grid: '#2c2c2a', axis: '#898781', ink: '#e5e5e5', areaFrom: 'rgba(57,135,229,0.34)', areaTo: 'rgba(57,135,229,0.01)', surface: '#0a0a0a', tipBg: '#111110', tipBorder: 'rgba(255,255,255,0.12)', cats: CATS_DARK }
    : { blue: '#2a78d6', orange: '#eb6834', grid: '#e1e0d9', axis: '#898781', ink: '#0b0b0b', areaFrom: 'rgba(42,120,214,0.26)', areaTo: 'rgba(42,120,214,0.01)', surface: '#ffffff', tipBg: '#ffffff', tipBorder: 'rgba(11,11,11,0.12)', cats: CATS_LIGHT }
}

export default function Dashboard({
  ledger,
  dark,
  range,
  interval,
  currency,
}: {
  ledger: LedgerView
  dark: boolean
  range: DateRange
  interval: Interval
  currency: string
}) {
  const P = palette(dark)
  const txns = ledger.transactions

  const money = (n: number) => `${new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency}`
  const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

  const view = useMemo(() => {
    const bsBalances = balancesFromTransactions(txns, { to: range.to }) // as of end
    const periodBalances = balancesFromTransactions(txns, { from: range.from, to: range.to })
    const bsTree = buildTree(bsBalances)
    const num = (roots: string[]) => sumRoots(bsTree, roots).get(currency)?.toNumber() ?? 0

    const ie = incomeExpenseByInterval(txns, currency, interval, range)
    const incomeP = ie.reduce((s, m) => s + m.income, 0)
    const expensesP = ie.reduce((s, m) => s + m.expenses, 0)

    const fromKey = range.from ? bucketKey(range.from, interval) : null
    const toKey = range.to ? bucketKey(range.to, interval) : null
    const nw = netWorthByInterval(txns, currency, interval).filter(
      (p) => (!fromKey || p.bucket >= fromKey) && (!toKey || p.bucket <= toKey),
    )

    return {
      netWorthNow: num(['Assets', 'Liabilities']),
      assetsNow: num(['Assets']),
      liabilitiesNow: num(['Liabilities']),
      incomeP,
      expensesP,
      netP: incomeP - expensesP,
      savingsRate: incomeP > 0 ? (incomeP - expensesP) / incomeP : 0,
      ie,
      nw,
      expenseCats: topN(categoryBreakdown(periodBalances, 'Expenses', currency), 9),
      incomeCats: topN(categoryBreakdown(periodBalances, 'Income', currency), 9),
      assetCats: categoryBreakdown(bsBalances, 'Assets', currency).slice(0, 6),
    }
  }, [txns, range, interval, currency])

  if (txns.length === 0) {
    return <Center>No transactions yet — add some to see your dashboard.</Center>
  }
  if (view.ie.length === 0 && view.nw.length === 0) {
    return <Center>No activity in this period. Widen the date range.</Center>
  }

  return (
    <div className="w-full space-y-4 p-4 lg:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Net worth" value={money(view.netWorthNow)} accent />
        <Stat label="Net income" value={money(view.netP)} positive={view.netP >= 0} />
        <Stat label="Income" value={money(view.incomeP)} />
        <Stat label="Expenses" value={money(view.expensesP)} />
        <Stat label="Savings rate" value={`${Math.round(view.savingsRate * 100)}%`} positive={view.savingsRate >= 0} />
        <Stat label="Liabilities" value={money(view.liabilitiesNow)} />
      </div>

      <Card title="Net worth over time">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={view.nw} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.areaFrom} />
                <stop offset="100%" stopColor={P.areaTo} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={P.grid} />
            <XAxis dataKey="label" tick={{ fill: P.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: P.grid }} minTickGap={28} />
            <YAxis tickFormatter={compact} tick={{ fill: P.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<Tip money={money} P={P} single="Net worth" />} />
            <Area type="monotone" dataKey="netWorth" stroke={P.blue} strokeWidth={2} fill="url(#nw)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Income vs expenses">
          <Legend items={[{ label: 'Income', color: P.blue }, { label: 'Expenses', color: P.orange }]} />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={view.ie} margin={{ top: 4, right: 12, bottom: 0, left: 8 }} barGap={2} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke={P.grid} />
              <XAxis dataKey="label" tick={{ fill: P.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: P.grid }} minTickGap={12} />
              <YAxis tickFormatter={compact} tick={{ fill: P.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
              <Tooltip cursor={{ fill: P.grid, opacity: 0.3 }} content={<Tip money={money} P={P} />} />
              <Bar dataKey="income" name="Income" fill={P.blue} radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill={P.orange} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Net cash flow">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={view.ie} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={P.areaFrom} />
                  <stop offset="100%" stopColor={P.areaTo} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={P.grid} />
              <XAxis dataKey="label" tick={{ fill: P.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: P.grid }} minTickGap={12} />
              <YAxis tickFormatter={compact} tick={{ fill: P.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
              <Tooltip cursor={{ fill: P.grid, opacity: 0.3 }} content={<Tip money={money} P={P} single="Net" dataKey="net" />} />
              <Area type="monotone" dataKey="net" stroke={P.blue} strokeWidth={2} fill="url(#net)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Where the money goes">
          <TreemapCard data={view.expenseCats} P={P} money={money} />
        </Card>
        <Card title="Where the money comes from">
          <TreemapCard data={view.incomeCats} P={P} money={money} />
        </Card>
      </div>

      <Card title="Assets">
        {view.assetCats.length === 0 ? (
          <Empty>No asset balances in this period.</Empty>
        ) : (
          <div className="space-y-1.5 pt-1">
            {view.assetCats.map((c) => {
              const max = view.assetCats[0]!.amount || 1
              return (
                <div key={c.account} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-neutral-600 dark:text-neutral-300">{c.label}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                    <div className="h-full rounded" style={{ width: `${Math.max(2, (c.amount / max) * 100)}%`, background: P.blue }} />
                  </div>
                  <span className="w-28 shrink-0 text-right text-sm tabular-nums">{money(c.amount)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function topN(cats: CategoryAmount[], n: number): CategoryAmount[] {
  if (cats.length <= n) return cats
  const head = cats.slice(0, n)
  const rest = cats.slice(n).reduce((s, c) => s + c.amount, 0)
  return [...head, { account: 'Other', label: 'Other', amount: rest }]
}

// ---- Treemap ----

function TreemapCard({ data, P, money }: { data: CategoryAmount[]; P: ReturnType<typeof palette>; money: (n: number) => string }) {
  if (data.length === 0) return <Empty>Nothing recorded in this period.</Empty>
  const nodes = data.map((c, i) => ({ name: c.label, size: c.amount, fill: P.cats[i % P.cats.length]! }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <Treemap data={nodes} dataKey="size" stroke={P.surface} isAnimationActive={false} content={<TreemapCell money={money} surface={P.surface} />}>
        <Tooltip content={<Tip money={money} P={P} single="" nameFromPayload />} />
      </Treemap>
    </ResponsiveContainer>
  )
}

function lum(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

// recharts injects x/y/width/height/name/value/fill; `money` is our own prop.
function TreemapCell(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  value?: number
  fill?: string
  surface?: string
  money?: (n: number) => string
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', value = 0, fill = '#888', surface = '#fff', money } = props
  if (width <= 0 || height <= 0) return null
  const ink = lum(fill) > 0.6 ? 'rgba(0,0,0,0.82)' : '#ffffff'
  const showLabel = width > 46 && height > 22
  const showValue = width > 60 && height > 38
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke={surface} strokeWidth={2} rx={3} />
      {showLabel && (
        <text x={x + 7} y={y + 16} fill={ink} fontSize={11} fontWeight={600}>
          {name}
        </text>
      )}
      {showValue && money && (
        <text x={x + 7} y={y + 30} fill={ink} opacity={0.85} fontSize={10}>
          {money(value)}
        </text>
      )}
    </g>
  )
}

// ---- Shared chrome ----

function Stat({ label, value, accent, positive }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3.5 py-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${accent ? 'text-amber-600 dark:text-amber-400' : positive === false ? 'text-rose-600 dark:text-rose-400' : ''}`}>
        {value}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>
      {children}
    </section>
  )
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-1 flex items-center gap-4">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center text-sm text-neutral-400">{children}</div>
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">{children}</div>
}

interface TipProps {
  money: (n: number) => string
  P: ReturnType<typeof palette>
  active?: boolean
  payload?: { value: number; name: string; payload: Record<string, unknown> }[]
  label?: string
  single?: string
  dataKey?: string
  nameFromPayload?: boolean
}

function Tip({ active, payload, label, money, P, single, dataKey, nameFromPayload }: TipProps) {
  if (!active || !payload?.length) return null
  const shell = (children: React.ReactNode) => (
    <div className="rounded-md px-2.5 py-1.5 text-xs shadow-sm" style={{ background: P.tipBg, border: `1px solid ${P.tipBorder}`, color: P.ink }}>
      {children}
    </div>
  )

  if (nameFromPayload) {
    const row = payload[0]!
    return shell(
      <>
        <div className="mb-0.5 text-neutral-400">{String(row.payload['name'] ?? '')}</div>
        <div className="font-semibold tabular-nums">{money(row.value)}</div>
      </>,
    )
  }

  if (single !== undefined) {
    const row = dataKey ? payload.find((p) => p.name === dataKey) ?? payload[0]! : payload[0]!
    return shell(
      <>
        <div className="mb-0.5 text-neutral-400">{label}</div>
        <div className="font-semibold tabular-nums">{money(row.value)}</div>
      </>,
    )
  }

  const income = payload.find((p) => p.name === 'Income')?.value ?? 0
  const expenses = payload.find((p) => p.name === 'Expenses')?.value ?? 0
  return shell(
    <>
      <div className="mb-1 text-neutral-400">{label}</div>
      <Row color={P.blue} label="Income" value={money(income)} />
      <Row color={P.orange} label="Expenses" value={money(expenses)} />
      <div className="mt-1 border-t border-neutral-200 pt-1 tabular-nums dark:border-neutral-700">Net {money(income - expenses)}</div>
    </>,
  )
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
