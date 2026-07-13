// Serialize a new transaction to beancount text for appending. We only ever
// PRINT new entries the user creates through the UI; existing text is edited by
// range, never reserialized, so hand-authored formatting is preserved. The output
// follows beancount's conventional two-space indent with amounts right-aligned.

import type { Dec } from './decimal'

export interface PostingDraft {
  account: string
  number: Dec | null // null => elided (beancount infers it)
  currency: string
}

export interface TransactionDraft {
  date: string
  flag: string
  payee: string | null
  narration: string
  tags: string[]
  links: string[]
  postings: PostingDraft[]
}

const AMOUNT_COL = 50 // column at which the amount's decimal-ish end aligns

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function formatTransaction(txn: TransactionDraft): string {
  const parts: string[] = [txn.date, txn.flag]
  if (txn.payee !== null && txn.payee !== '') parts.push(`"${escapeString(txn.payee)}"`)
  parts.push(`"${escapeString(txn.narration)}"`)
  for (const t of txn.tags) parts.push(`#${t}`)
  for (const l of txn.links) parts.push(`^${l}`)
  const header = parts.join(' ')

  const lines = txn.postings.map((p) => {
    if (p.number === null) return `  ${p.account}`
    const amount = `${p.number.toString()} ${p.currency}`
    const left = `  ${p.account}`
    const pad = Math.max(2, AMOUNT_COL - left.length - amount.length)
    return left + ' '.repeat(pad) + amount
  })

  return [header, ...lines].join('\n')
}

/** Append a formatted entry to a ledger's text, ensuring one blank line before it
 *  and a trailing newline. */
export function appendEntry(source: string, entryText: string): string {
  const trimmed = source.replace(/\s+$/, '')
  if (trimmed === '') return entryText + '\n'
  return trimmed + '\n\n' + entryText + '\n'
}

/** Remove the [startLine, endLine] span (0-based inclusive) from the text, along
 *  with an immediately-following blank separator line if present. */
export function removeLines(source: string, startLine: number, endLine: number): string {
  const lines = source.split('\n')
  let end = endLine
  if (lines[end + 1] !== undefined && lines[end + 1]!.trim() === '') end++
  lines.splice(startLine, end - startLine + 1)
  return lines.join('\n')
}
