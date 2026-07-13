import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import type { Problem } from '~/beancount'

// A compact banner summarizing parse/validation problems, expandable to a list.
// Clicking a problem jumps to its line in the Source view.
export default function ProblemsBar({ problems, onJump }: { problems: Problem[]; onJump: (line: number) => void }) {
  const [open, setOpen] = useState(false)
  if (problems.length === 0) return null
  const errors = problems.filter((p) => p.severity === 'error').length

  return (
    <div className="shrink-0 border-b border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs font-medium"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <AlertTriangle size={13} />
        {errors} {errors === 1 ? 'problem' : 'problems'} in this ledger
        <span className="ml-1 font-normal text-rose-500 dark:text-rose-400">click to review</span>
      </button>
      {open && (
        <ul className="max-h-40 overflow-y-auto px-4 pb-2">
          {problems.map((p, i) => (
            <li key={i}>
              <button
                onClick={() => onJump(p.line)}
                className="block w-full py-0.5 text-left text-xs hover:underline"
              >
                <span className="tnum text-rose-500 dark:text-rose-400">line {p.line + 1}</span> — {p.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
