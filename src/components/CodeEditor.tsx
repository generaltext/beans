import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { beancount } from '~/editor/beancount-lang'

// Editor chrome is themed entirely through CSS variables (global.css), so the one
// theme serves light and dark without JS reconfiguration.
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent', color: 'var(--cm-fg)' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.55', overflow: 'auto' },
  '.cm-content': { caretColor: 'var(--cm-caret)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--cm-caret)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--cm-selection)',
  },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--cm-gutter)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--cm-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--cm-active)', color: 'var(--cm-gutter-active)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },
})

export interface JumpRequest {
  line: number // 0-based
  n: number // nonce so repeat clicks re-fire
}

export default function CodeEditor({
  value,
  onChange,
  jump,
}: {
  value: string
  onChange: (next: string) => void
  jump: JumpRequest | null
}) {
  const parent = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Create the view once.
  useEffect(() => {
    if (!parent.current) return
    const view = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          indentOnInput(),
          bracketMatching(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          beancount(),
          theme,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Controlled: reflect external changes (a peer edit, or a structured add) into
  // the doc. Our own edits round-trip to the same string, so this is a no-op then.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  // Jump to a line (clicking a problem).
  useEffect(() => {
    const view = viewRef.current
    if (!view || !jump) return
    const lineNo = Math.min(Math.max(jump.line + 1, 1), view.state.doc.lines)
    const line = view.state.doc.line(lineNo)
    view.dispatch({ selection: { anchor: line.from, head: line.to }, scrollIntoView: true })
    view.focus()
  }, [jump])

  return <div ref={parent} className="min-h-0 flex-1 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800" />
}
