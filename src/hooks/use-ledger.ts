// use-ledger.ts — the data layer. Each ledger is ONE synced plaintext file under
// `v0/` (a real beancount file the user, their editor, or their AI can read
// anywhere). A workspace can hold MANY ledgers — one per financial entity
// (personal, a business, a client) — and the app switches between them; the file
// list is the entity list. Edits are applied to the active file by RANGE (append
// a new entry, remove an entry's lines) so untouched entries keep their exact
// formatting. Talks to General Text only through `window.gt`.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  appendEntry,
  formatTransaction,
  parse,
  realize,
  removeLines,
  SAMPLE_LEDGER,
  type Ledger,
  type Problem,
  type TransactionDraft,
} from '~/beancount'

export const DATA_DIR = 'v0/'
export const DEFAULT_PATH = 'v0/main.beancount'
const LEDGER_RE = /^v0\/.+\.beancount$/

export interface LedgerEntity {
  path: string
  name: string // option "title", else a prettified filename
}

/** Seed the sample ledger into an empty throwaway workspace (standalone `pnpm
 *  dev` and the "Try it live" demo) so the app never opens blank. Inert in a real
 *  workspace, and only ever seeds when there are no ledger files yet. */
async function maybeSeed() {
  const gt = window.gt
  if (gt.mode !== 'demo' && !gt.sync.isLocal) return
  const files = await gt.listFiles()
  if (files.some((f) => LEDGER_RE.test(f.path) && f.sizeBytes > 0)) return
  await gt.writeFile(DEFAULT_PATH, SAMPLE_LEDGER).catch(() => {})
}

function titleOf(text: string): string | null {
  const m = /^option\s+"title"\s+"((?:[^"\\]|\\.)*)"/m.exec(text)
  return m ? m[1]!.replace(/\\(.)/g, '$1') : null
}

function prettify(path: string): string {
  return path.replace(/^v0\//, '').replace(/\.beancount$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ledger'
}

export interface LedgerView extends Ledger {
  problems: Problem[]
  source: string
  fileExists: boolean
}

export function useLedger() {
  const gt = window.gt
  const [connected, setConnected] = useState(false)
  const [paths, setPaths] = useState<string[]>([])
  const [activePath, setActivePath] = useState(DEFAULT_PATH)
  const [source, setSource] = useState('')
  const [titles, setTitles] = useState<Record<string, string>>({})
  const textRef = useRef<GtText | null>(null)

  // Connection + one-time seed + file-list watch.
  useEffect(() => {
    gt.ready.then(() => setConnected(true)).catch(() => {})
    void maybeSeed()
    const unsubs = [
      gt.on('connected', () => setConnected(true)),
      gt.on('disconnected', () => setConnected(false)),
      gt.watchFiles((all) => setPaths(all.filter((p) => LEDGER_RE.test(p)).sort())),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [gt])

  // Keep the active path valid: if it vanished (or none chosen), fall back to the
  // default, else the first ledger present.
  useEffect(() => {
    if (paths.length === 0) return
    if (!paths.includes(activePath)) setActivePath(paths.includes(DEFAULT_PATH) ? DEFAULT_PATH : paths[0]!)
  }, [paths, activePath])

  // Read titles for the switcher (cheap: one readFile per ledger file).
  useEffect(() => {
    let cancelled = false
    Promise.all(paths.map(async (p) => [p, titleOf(await gt.readFile(p).catch(() => ''))] as const)).then((entries) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [p, t] of entries) if (t) next[p] = t
      setTitles(next)
    })
    return () => {
      cancelled = true
    }
  }, [gt, paths])

  // Subscribe to the active ledger file.
  useEffect(() => {
    if (!connected) return
    const yt = gt.subscribeFile(activePath)
    textRef.current = yt
    const update = () => setSource(yt.toString())
    update()
    yt.observe(update)
    return () => {
      yt.unobserve(update)
      textRef.current = null
    }
  }, [gt, connected, activePath])

  const ledger: LedgerView = useMemo(() => {
    const { entries, errors, options } = parse(source)
    const realized = realize(entries, options)
    const problems: Problem[] = [
      ...errors.map((e) => ({ line: e.line, message: e.message, severity: 'error' as const })),
      ...realized.problems,
    ].sort((a, b) => a.line - b.line)
    return { ...realized, problems, source, fileExists: paths.includes(activePath) }
  }, [source, paths, activePath])

  const ledgers: LedgerEntity[] = useMemo(
    () => paths.map((p) => ({ path: p, name: titles[p] || prettify(p) })),
    [paths, titles],
  )

  function write(next: string) {
    const yt = textRef.current ?? gt.subscribeFile(activePath)
    gt.applyDiff(yt, yt.toString(), next)
  }

  const actions = {
    addTransaction(draft: TransactionDraft) {
      const yt = textRef.current ?? gt.subscribeFile(activePath)
      write(appendEntry(yt.toString(), formatTransaction(draft)))
    },
    deleteEntry(startLine: number, endLine: number) {
      const yt = textRef.current ?? gt.subscribeFile(activePath)
      write(removeLines(yt.toString(), startLine, endLine))
    },
    setSource(next: string) {
      write(next)
    },
    /** Seed a starter sample into the active (empty) ledger. */
    createStarter() {
      write(SAMPLE_LEDGER)
    },
    /** Create a new ledger (a new financial entity) and switch to it. With
     *  `content` it imports that beancount text; otherwise it seeds a minimal
     *  starter with the given title. */
    async createLedger(name: string, content?: string): Promise<void> {
      const slug = slugify(name)
      let path = `${DATA_DIR}${slug}.beancount`
      let n = 2
      while (paths.includes(path)) path = `${DATA_DIR}${slug}-${n++}.beancount`
      const starter = `option "title" "${name.replace(/"/g, '')}"\noption "operating_currency" "USD"\n\n`
      await gt.writeFile(path, content ?? starter)
      setActivePath(path)
    },
  }

  return { connected, ledger, ledgers, activePath, setActivePath, actions } as const
}

export type LedgerActions = ReturnType<typeof useLedger>['actions']
