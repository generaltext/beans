import CodeEditor, { type JumpRequest } from '~/components/CodeEditor'
import type { LedgerView } from '~/hooks/use-ledger'

// The raw beancount file, editable in a real CodeMirror editor with syntax
// highlighting. This is the "it's still just a text file" escape hatch: the same
// canonical file the structured views read. Edits write straight back through the
// runtime's minimal-diff, so a change here merges with collaborators exactly like
// the structured edits do.
export default function SourceView({
  ledger,
  path,
  onChange,
  jump,
}: {
  ledger: LedgerView
  path: string
  onChange: (next: string) => void
  jump: JumpRequest | null
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-neutral-500">{path}</span>
        <span className="text-xs text-neutral-400">{ledger.source.split('\n').length} lines · beancount</span>
      </div>
      <CodeEditor value={ledger.source} onChange={onChange} jump={jump} />
    </div>
  )
}
