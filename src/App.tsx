import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Moon, Sun, Upload } from 'lucide-react'
import type { Interval } from '~/beancount'
import { BeansMark } from '~/components/BeansMark'
import type { JumpRequest } from '~/components/CodeEditor'
import Dashboard from '~/components/Dashboard'
import FilterBar from '~/components/FilterBar'
import JournalView from '~/components/JournalView'
import LedgerSwitcher from '~/components/LedgerSwitcher'
import ProblemsBar from '~/components/ProblemsBar'
import ReportsView from '~/components/ReportsView'
import SourceView from '~/components/SourceView'
import TransactionsView from '~/components/TransactionsView'
import { DEFAULT_PATH, useLedger } from '~/hooks/use-ledger'
import { useTheme } from '~/hooks/use-theme'
import { ALL_TIME, presetRanges, type DateRange } from '~/lib/filters'

type Tab = 'overview' | 'transactions' | 'reports' | 'journal' | 'source'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reports', label: 'Reports' },
  { id: 'journal', label: 'Journal' },
  { id: 'source', label: 'Source' },
]

export default function App() {
  const { connected, ledger, ledgers, activePath, setActivePath, actions } = useLedger()
  const { dark, canToggle, toggle } = useTheme()
  const [tab, setTab] = useState<Tab>('overview')
  const [jump, setJump] = useState<JumpRequest | null>(null)
  const [range, setRange] = useState<DateRange>(ALL_TIME)
  const [interval, setInterval] = useState<Interval>('month')
  const jumpN = useRef(0)
  const importRef = useRef<HTMLInputElement | null>(null)

  const isDemo = window.gt.version === 'demo' || window.gt.mode === 'demo'
  const hasLedger = ledger.source.trim() !== ''
  const currency = ledger.options['operating_currency'] || ledger.commodities[0] || 'USD'
  const presets = useMemo(() => presetRanges(ledger.transactions), [ledger.transactions])

  // Switching ledgers resets the period filter (its presets are per-ledger).
  useEffect(() => {
    setRange(ALL_TIME)
  }, [activePath])

  function goToLine(line: number) {
    setTab('source')
    jumpN.current += 1
    setJump({ line, n: jumpN.current })
  }

  function onNewLedger() {
    const name = window.prompt('Name this ledger (e.g. "Acme LLC", "Personal")')
    if (name && name.trim()) void actions.createLedger(name.trim())
  }

  // Import brings a .beancount file in as its OWN new ledger (non-destructive).
  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const title = /^option\s+"title"\s+"((?:[^"\\]|\\.)*)"/m.exec(text)?.[1]
      const name = title || file.name.replace(/\.(beancount|bean)$/i, '')
      void actions.createLedger(name, text)
      if (importRef.current) importRef.current.value = ''
    }
    reader.readAsText(file)
  }

  function onExport() {
    const blob = new Blob([ledger.source], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `beans_${new Date().toISOString().slice(0, 10)}.beancount`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="relative z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <BeansMark className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
            <h1 className="text-sm font-bold tracking-tight">Beans</h1>
          </div>
          {hasLedger && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">/</span>
              <LedgerSwitcher ledgers={ledgers} activePath={activePath} onSwitch={setActivePath} onNew={onNewLedger} />
            </>
          )}
        </div>

        <nav className="order-3 flex w-full gap-1 lg:order-2 lg:w-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-2 lg:order-3">
          {isDemo && (
            <a
              href="https://www.generaltext.org"
              title="You're using sample data, stored locally. Open General Text to use Beans for real."
              className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/25 dark:text-amber-300"
            >
              Demo
            </a>
          )}
          <ConnDot connected={connected} />
          {canToggle && (
            <button
              onClick={toggle}
              title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          )}
          <button
            onClick={() => importRef.current?.click()}
            title="Import a .beancount file"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Upload size={13} /> Import
          </button>
          <button
            onClick={onExport}
            disabled={!hasLedger}
            title="Download the ledger as a .beancount file"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Download size={13} /> Export
          </button>
          <input ref={importRef} type="file" accept=".beancount,.bean,text/plain" className="hidden" onChange={onImportFile} />
        </div>
      </header>

      <ProblemsBar problems={ledger.problems} onJump={goToLine} />

      {!connected ? (
        <Centered>Connecting to your workspace…</Centered>
      ) : !hasLedger ? (
        <EmptyState onCreate={actions.createStarter} onImport={() => importRef.current?.click()} />
      ) : (
        <>
          {tab !== 'source' && (
            <FilterBar
              presets={presets}
              range={range}
              onRange={setRange}
              interval={interval}
              onInterval={setInterval}
              currency={currency}
              showInterval={tab === 'overview'}
            />
          )}
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {tab === 'overview' && (
              <Dashboard ledger={ledger} dark={dark} range={range} interval={interval} currency={currency} />
            )}
            {tab === 'transactions' && (
              <TransactionsView ledger={ledger} range={range} onAdd={actions.addTransaction} onDelete={actions.deleteEntry} />
            )}
            {tab === 'reports' && <ReportsView ledger={ledger} range={range} currency={currency} />}
            {tab === 'journal' && <JournalView ledger={ledger} range={range} />}
            {tab === 'source' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <SourceView ledger={ledger} path={activePath} onChange={actions.setSource} jump={jump} />
              </div>
            )}
          </main>
        </>
      )}
    </div>
  )
}

function EmptyState({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <BeansMark className="h-10 w-10 text-amber-500" />
      <div className="max-w-md space-y-1.5">
        <h2 className="text-base font-semibold">Start your ledger</h2>
        <p className="text-sm text-neutral-500">
          Beans keeps each set of books in a plain <code className="font-mono text-xs">{DEFAULT_PATH}</code> file —
          fully beancount-compatible. Start from a sample, or import an existing <code className="font-mono text-xs">.beancount</code> file.
          You can keep several ledgers (one per entity) in a workspace.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCreate}
          className="rounded-md bg-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-amber-500"
        >
          Create a sample ledger
        </button>
        <button
          onClick={onImport}
          className="rounded-md border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Import a file
        </button>
      </div>
    </div>
  )
}

function ConnDot({ connected }: { connected: boolean }) {
  return (
    <span
      title={connected ? 'Connected' : 'Disconnected'}
      className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
    />
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">{children}</div>
}
