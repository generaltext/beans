import { useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import type { LedgerEntity } from '~/hooks/use-ledger'

// Switches between the ledgers (financial entities) in the workspace — each is its
// own `.beancount` file under the app's data folder. The file list IS the entity
// list; "New ledger" creates another file.
export default function LedgerSwitcher({
  ledgers,
  activePath,
  onSwitch,
  onNew,
}: {
  ledgers: LedgerEntity[]
  activePath: string
  onSwitch: (path: string) => void
  onNew: () => void
}) {
  const [open, setOpen] = useState(false)
  const active = ledgers.find((l) => l.path === activePath)
  const label = active?.name ?? 'Ledger'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[12rem] items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
        title="Switch ledger / entity"
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown size={13} className="shrink-0 text-neutral-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-40 mt-1 min-w-[13rem] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Ledgers</div>
            {ledgers.map((l) => (
              <button
                key={l.path}
                onClick={() => {
                  onSwitch(l.path)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Check size={14} className={l.path === activePath ? 'text-amber-600 dark:text-amber-400' : 'invisible'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{l.name}</span>
                  <span className="block truncate font-mono text-[10px] text-neutral-400">{l.path.replace(/^v0\//, '')}</span>
                </span>
              </button>
            ))}
            <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
            <button
              onClick={() => {
                setOpen(false)
                onNew()
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Plus size={14} className="text-neutral-400" />
              New ledger…
            </button>
          </div>
        </>
      )}
    </div>
  )
}
