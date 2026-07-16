import { useEffect, useRef, useState } from 'react'
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
  onNew: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  // Inline naming input — apps run in a sandboxed iframe without `allow-modals`, so
  // `window.prompt` is inert (returns null, no dialog). Name the ledger in-app instead.
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const active = ledgers.find((l) => l.path === activePath)
  const label = active?.name ?? 'Ledger'

  useEffect(() => {
    if (naming) nameRef.current?.focus()
  }, [naming])

  function close() {
    setOpen(false)
    setNaming(false)
    setName('')
  }
  function submitName() {
    const trimmed = name.trim()
    if (trimmed) onNew(trimmed)
    close()
  }

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
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute left-0 z-40 mt-1 min-w-[13rem] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Ledgers</div>
            {ledgers.map((l) => (
              <button
                key={l.path}
                onClick={() => {
                  onSwitch(l.path)
                  close()
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
            {naming ? (
              <div className="px-2 py-1">
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitName()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setNaming(false)
                      setName('')
                    }
                  }}
                  placeholder='Name it (e.g. "Acme LLC", "Personal")'
                  className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-800 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                />
                <div className="mt-1.5 flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setNaming(false)
                      setName('')
                    }}
                    className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitName}
                    disabled={!name.trim()}
                    className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setNaming(true)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Plus size={14} className="text-neutral-400" />
                New ledger…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
