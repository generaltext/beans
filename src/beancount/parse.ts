// A pragmatic, pure-TS beancount parser. It is line-oriented (beancount is), and
// its job is twofold: produce an AST for the app's structured views, and record
// each entry's source line span so edits can be applied to the text by range.
//
// It aims to accept real beancount files (the common directive set and posting
// syntax); constructs it does not model yet (arithmetic in amounts, `custom`,
// `query`) are skipped without failing the whole parse. Unrecognized lines become
// errors attached to their line, never a thrown exception.

import { Dec } from './decimal'
import type {
  Amount,
  Cost,
  Entry,
  MaybeAmount,
  ParseError,
  ParseResult,
  Posting,
  Price,
  TransactionDirective,
} from './types'

const ACCOUNT_RE = /^[A-Z][A-Za-z0-9\-]*(?::[A-Z0-9][A-Za-z0-9\-]*)+/
const CURRENCY_RE = /[A-Z][A-Z0-9'._-]{0,22}[A-Z0-9]|[A-Z]/
const NUMBER_RE = /^[-+]?[\d,]+(?:\.\d+)?/
const DATE_RE = /^(\d{4})[-/](\d{2})[-/](\d{2})/
const TXN_FLAGS = new Set(['*', '!', 'txn', '&', '#', '?', '%', 'P', 'S', 'T', 'C', 'U', 'R', 'M'])

function normDate(m: RegExpMatchArray): string {
  return `${m[1]}-${m[2]}-${m[3]}`
}

/** Strip a trailing `; comment` that is not inside a string. */
function stripComment(s: string): string {
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '"') inStr = !inStr
    else if (c === ';' && !inStr) return s.slice(0, i)
  }
  return s
}

/** Pull leading `"..."` strings (with \" escapes) off the front of `s`. */
function takeStrings(s: string, max: number): { strings: string[]; rest: string } {
  const strings: string[] = []
  let rest = s.trimStart()
  while (strings.length < max) {
    const m = /^"((?:[^"\\]|\\.)*)"/.exec(rest)
    if (!m) break
    strings.push(m[1]!.replace(/\\(.)/g, '$1'))
    rest = rest.slice(m[0].length).trimStart()
  }
  return { strings, rest }
}

function takeTagsAndLinks(s: string): { tags: string[]; links: string[]; rest: string } {
  const tags: string[] = []
  const links: string[] = []
  let rest = s
  const re = /(?:^|\s)([#^])([A-Za-z0-9\-_/.]+)/g
  let m: RegExpExecArray | null
  const consumed: [number, number][] = []
  while ((m = re.exec(rest))) {
    if (m[1] === '#') tags.push(m[2]!)
    else links.push(m[2]!)
    consumed.push([m.index, m.index + m[0].length])
  }
  // remove consumed spans back-to-front
  for (let i = consumed.length - 1; i >= 0; i--) {
    const [a, b] = consumed[i]!
    rest = rest.slice(0, a) + rest.slice(b)
  }
  return { tags, links, rest: rest.trim() }
}

/** Parse `NUMBER CURRENCY` at the start of `s`. Returns the amount + remaining. */
function takeAmount(s: string): { amount: Amount | null; rest: string } {
  const t = s.trimStart()
  const nm = NUMBER_RE.exec(t)
  if (!nm) return { amount: null, rest: s }
  const num = Dec.parse(nm[0])
  if (!num) return { amount: null, rest: s }
  let after = t.slice(nm[0].length).trimStart()
  const cm = new RegExp('^(' + CURRENCY_RE.source + ')').exec(after)
  if (!cm) return { amount: null, rest: s }
  after = after.slice(cm[0].length)
  return { amount: { number: num, currency: cm[1]! }, rest: after }
}

function parseCost(inner: string, total: boolean): Cost {
  const cost: Cost = { number: null, currency: null, total }
  for (const part of inner.split(',')) {
    const p = part.trim()
    if (!p) continue
    const str = /^"((?:[^"\\]|\\.)*)"$/.exec(p)
    const date = DATE_RE.exec(p)
    const amt = takeAmount(p)
    if (str) cost.label = str[1]!.replace(/\\(.)/g, '$1')
    else if (date && date[0].length === p.length) cost.date = normDate(date)
    else if (amt.amount) {
      cost.number = amt.amount.number
      cost.currency = amt.amount.currency
    }
  }
  return cost
}

/** Parse the amount/cost/price tail of a posting line (after the account). */
function parsePostingTail(s: string): Pick<Posting, 'units' | 'cost' | 'price'> {
  let rest = s.trim()
  let units: MaybeAmount | null = null
  let cost: Cost | undefined
  let price: Price | undefined

  const amt = takeAmount(rest)
  if (amt.amount) {
    units = { number: amt.amount.number, currency: amt.amount.currency }
    rest = amt.rest.trimStart()
  }

  // cost {{...}} or {...}
  const totalCost = /^\{\{([^}]*)\}\}/.exec(rest)
  const perCost = /^\{([^}]*)\}/.exec(rest)
  if (totalCost) {
    cost = parseCost(totalCost[1]!, true)
    rest = rest.slice(totalCost[0].length).trimStart()
  } else if (perCost) {
    cost = parseCost(perCost[1]!, false)
    rest = rest.slice(perCost[0].length).trimStart()
  }

  // price @@ (total) or @ (per unit)
  const priceTotal = rest.startsWith('@@')
  const pricePer = !priceTotal && rest.startsWith('@')
  if (priceTotal || pricePer) {
    rest = rest.slice(priceTotal ? 2 : 1).trimStart()
    const pamt = takeAmount(rest)
    if (pamt.amount) {
      price = { number: pamt.amount.number, currency: pamt.amount.currency, total: priceTotal }
    }
  }

  const posting: Pick<Posting, 'units' | 'cost' | 'price'> = { units }
  if (cost) posting.cost = cost
  if (price) posting.price = price
  return posting
}

const META_RE = /^([a-z][a-zA-Z0-9\-_]*):\s?(.*)$/

interface RawEntry {
  headerLine: number
  header: string
  continuation: { line: number; indent: number; text: string }[]
  endLine: number
}

/** Group physical lines into entries (a col-0 header plus its indented body). */
function groupEntries(lines: string[]): { entries: RawEntry[]; skip: Set<number> } {
  const entries: RawEntry[] = []
  const skip = new Set<number>()
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    const trimmed = line.trim()
    // blank or comment / org-heading at col 0 → not an entry
    if (trimmed === '' || /^[;*#]/.test(line) || /^\s/.test(line)) {
      i++
      continue
    }
    const header = line
    const continuation: RawEntry['continuation'] = []
    let j = i + 1
    while (j < lines.length) {
      const l = lines[j]!
      if (l.trim() === '') break // blank ends the body
      if (!/^\s/.test(l)) break // col-0 line starts the next entry
      const indent = l.length - l.trimStart().length
      const body = stripComment(l).trim()
      if (body !== '') continuation.push({ line: j, indent, text: body })
      j++
    }
    entries.push({ headerLine: i, header, continuation, endLine: j - 1 })
    i = j
  }
  return { entries, skip }
}

export function parse(source: string): ParseResult {
  const lines = source.split('\n')
  const { entries: raw } = groupEntries(lines)
  const entries: Entry[] = []
  const errors: ParseError[] = []
  const options: Record<string, string> = {}
  const tagStack: string[] = []

  const err = (line: number, message: string) =>
    errors.push({ line, message, severity: 'error' })

  for (const re of raw) {
    const header = stripComment(re.header).trimEnd()
    const span = { startLine: re.headerLine, endLine: re.endLine }

    // Keyword entries (no leading date).
    const kw = /^([a-z]+)\b\s*(.*)$/.exec(header)
    if (kw && !DATE_RE.test(header)) {
      const [, keyword, rest] = kw as unknown as [string, string, string]
      if (keyword === 'option') {
        const { strings } = takeStrings(rest, 2)
        if (strings.length === 2) options[strings[0]!] = strings[1]!
        entries.push({ type: 'option', key: strings[0] ?? '', value: strings[1] ?? '', ...span })
        continue
      }
      if (keyword === 'plugin') {
        const { strings } = takeStrings(rest, 2)
        entries.push({ type: 'plugin', name: strings[0] ?? '', config: strings[1] ?? null, ...span })
        continue
      }
      if (keyword === 'include') {
        const { strings } = takeStrings(rest, 1)
        entries.push({ type: 'include', filename: strings[0] ?? '', ...span })
        continue
      }
      if (keyword === 'pushtag') {
        const t = /#([A-Za-z0-9\-_/.]+)/.exec(rest)
        if (t) tagStack.push(t[1]!)
        continue
      }
      if (keyword === 'poptag') {
        const t = /#([A-Za-z0-9\-_/.]+)/.exec(rest)
        if (t) {
          const idx = tagStack.lastIndexOf(t[1]!)
          if (idx >= 0) tagStack.splice(idx, 1)
        }
        continue
      }
      err(re.headerLine, `Unknown directive "${keyword}"`)
      continue
    }

    // Date-led directives.
    const dm = DATE_RE.exec(header)
    if (!dm) {
      err(re.headerLine, `Line does not start with a date or known keyword`)
      continue
    }
    const date = normDate(dm)
    const afterDate = header.slice(dm[0].length).trimStart()
    const tokMatch = /^(\S+)/.exec(afterDate)
    const tok = tokMatch ? tokMatch[1]! : ''
    const rest = afterDate.slice(tok.length).trimStart()

    if (TXN_FLAGS.has(tok)) {
      entries.push(parseTransaction(re, date, tok === 'txn' ? '*' : tok, rest, tagStack, span, err))
      continue
    }

    switch (tok) {
      case 'open': {
        const parts = rest.split(/\s+/).filter(Boolean)
        const account = parts[0] ?? ''
        const currencies = (parts[1] ?? '').split(',').map((c) => c.trim()).filter(Boolean)
        if (!ACCOUNT_RE.test(account)) err(re.headerLine, `open: invalid account "${account}"`)
        entries.push({ type: 'open', date, account, currencies, ...span })
        break
      }
      case 'close': {
        const account = rest.trim()
        entries.push({ type: 'close', date, account, ...span })
        break
      }
      case 'commodity': {
        const currency = rest.trim()
        entries.push({ type: 'commodity', date, currency, meta: collectMeta(re, err), ...span })
        break
      }
      case 'balance': {
        const acc = /^(\S+)\s+(.*)$/.exec(rest)
        if (!acc) {
          err(re.headerLine, `balance: expected "account amount"`)
          break
        }
        const amt = takeAmount(acc[2]!)
        if (!amt.amount) {
          err(re.headerLine, `balance: could not parse amount`)
          break
        }
        // optional tolerance: `amount ~ tol CUR`
        let tolerance: Dec | null = null
        const tolM = /~\s*([\d.,]+)/.exec(acc[2]!)
        if (tolM) tolerance = Dec.parse(tolM[1]!)
        entries.push({ type: 'balance', date, account: acc[1]!, amount: amt.amount, tolerance, ...span })
        break
      }
      case 'pad': {
        const parts = rest.split(/\s+/).filter(Boolean)
        entries.push({ type: 'pad', date, account: parts[0] ?? '', sourceAccount: parts[1] ?? '', ...span })
        break
      }
      case 'price': {
        const m = /^(\S+)\s+(.*)$/.exec(rest)
        if (!m) {
          err(re.headerLine, `price: expected "COMMODITY amount"`)
          break
        }
        const amt = takeAmount(m[2]!)
        if (!amt.amount) {
          err(re.headerLine, `price: could not parse amount`)
          break
        }
        entries.push({ type: 'price', date, currency: m[1]!, amount: amt.amount, ...span })
        break
      }
      case 'note': {
        const m = /^(\S+)\s+"((?:[^"\\]|\\.)*)"/.exec(rest)
        entries.push({ type: 'note', date, account: m?.[1] ?? '', comment: m?.[2] ?? '', ...span })
        break
      }
      case 'document': {
        const m = /^(\S+)\s+"((?:[^"\\]|\\.)*)"/.exec(rest)
        entries.push({ type: 'document', date, account: m?.[1] ?? '', filename: m?.[2] ?? '', ...span })
        break
      }
      case 'event': {
        const { strings } = takeStrings(rest, 2)
        entries.push({ type: 'event', date, name: strings[0] ?? '', value: strings[1] ?? '', ...span })
        break
      }
      case 'query':
      case 'custom':
        // recognized but not modeled — skip silently
        break
      default:
        err(re.headerLine, `Unknown directive "${tok}"`)
    }
  }

  return { entries, errors, options }
}

/** Collect `key: value` metadata lines from an entry body. */
function collectMeta(re: RawEntry, _err: (l: number, m: string) => void): Record<string, string> {
  const meta: Record<string, string> = {}
  for (const c of re.continuation) {
    const m = META_RE.exec(c.text)
    if (m) meta[m[1]!] = m[2]!.trim()
  }
  return meta
}

function parseTransaction(
  re: RawEntry,
  date: string,
  flag: string,
  headerRest: string,
  tagStack: string[],
  span: { startLine: number; endLine: number },
  err: (l: number, m: string) => void,
): TransactionDirective {
  const { strings, rest: afterStrings } = takeStrings(headerRest, 2)
  let payee: string | null = null
  let narration = ''
  if (strings.length === 2) {
    payee = strings[0]!
    narration = strings[1]!
  } else if (strings.length === 1) {
    narration = strings[0]!
  }
  const { tags, links } = takeTagsAndLinks(afterStrings)

  const postings: Posting[] = []
  const meta: Record<string, string> = {}
  let lastPosting: Posting | null = null

  for (const c of re.continuation) {
    const metaM = META_RE.exec(c.text)
    if (metaM) {
      if (lastPosting) lastPosting.meta[metaM[1]!] = metaM[2]!.trim()
      else meta[metaM[1]!] = metaM[2]!.trim()
      continue
    }
    // posting: optional leading flag, then account, then amount/cost/price
    let body = c.text
    let pflag: string | undefined
    const flagM = /^([*!&?%PSTCURM#])\s+/.exec(body)
    if (flagM) {
      pflag = flagM[1]!
      body = body.slice(flagM[0].length)
    }
    const accM = ACCOUNT_RE.exec(body)
    if (!accM) {
      err(c.line, `Could not parse posting: "${c.text}"`)
      continue
    }
    const account = accM[0]
    const tail = parsePostingTail(body.slice(account.length))
    const posting: Posting = { account, units: tail.units, meta: {} }
    if (pflag) posting.flag = pflag
    if (tail.cost) posting.cost = tail.cost
    if (tail.price) posting.price = tail.price
    postings.push(posting)
    lastPosting = posting
  }

  return {
    type: 'transaction',
    date,
    flag,
    payee,
    narration,
    tags: [...new Set([...tagStack, ...tags])],
    links,
    postings,
    meta,
    ...span,
  }
}
