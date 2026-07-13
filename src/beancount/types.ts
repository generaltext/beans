// The beancount AST. We model the directives Beans understands; every entry
// carries its source line span ([startLine, endLine], 0-based inclusive) so the
// app can edit the underlying text by RANGE — append, replace, or delete an
// entry's exact lines — without reserializing (and thus reformatting) the whole
// file. That is what keeps a hand-authored .beancount file byte-stable except
// where the user actually changed something.

import type { Dec } from './decimal'

export interface Amount {
  number: Dec
  currency: string
}

/** A posting amount that may be left blank for beancount to infer (at most one
 *  per transaction). */
export interface MaybeAmount {
  number: Dec | null
  currency: string | null
}

export interface Cost {
  /** per-unit ({...}) or total ({{...}}) cost basis */
  number: Dec | null
  currency: string | null
  total: boolean
  date?: string
  label?: string
}

export interface Price {
  number: Dec
  currency: string
  /** @@ (total) vs @ (per-unit) */
  total: boolean
}

export interface Posting {
  flag?: string
  account: string
  units: MaybeAmount | null
  cost?: Cost
  price?: Price
  meta: Record<string, string>
}

export interface Span {
  startLine: number
  endLine: number
}

interface Base extends Span {
  date: string // YYYY-MM-DD
}

export interface OpenDirective extends Base {
  type: 'open'
  account: string
  currencies: string[]
  booking?: string
}

export interface CloseDirective extends Base {
  type: 'close'
  account: string
}

export interface CommodityDirective extends Base {
  type: 'commodity'
  currency: string
  meta: Record<string, string>
}

export interface TransactionDirective extends Base {
  type: 'transaction'
  flag: string // '*', '!', or a custom char
  payee: string | null
  narration: string
  tags: string[]
  links: string[]
  postings: Posting[]
  meta: Record<string, string>
}

export interface BalanceDirective extends Base {
  type: 'balance'
  account: string
  amount: Amount
  tolerance: Dec | null
}

export interface PadDirective extends Base {
  type: 'pad'
  account: string
  sourceAccount: string
}

export interface PriceDirective extends Base {
  type: 'price'
  currency: string
  amount: Amount
}

export interface NoteDirective extends Base {
  type: 'note'
  account: string
  comment: string
}

export interface DocumentDirective extends Base {
  type: 'document'
  account: string
  filename: string
}

export interface EventDirective extends Base {
  type: 'event'
  name: string
  value: string
}

export interface OptionEntry extends Span {
  type: 'option'
  key: string
  value: string
}

export interface PluginEntry extends Span {
  type: 'plugin'
  name: string
  config: string | null
}

export interface IncludeEntry extends Span {
  type: 'include'
  filename: string
}

export type Directive =
  | OpenDirective
  | CloseDirective
  | CommodityDirective
  | TransactionDirective
  | BalanceDirective
  | PadDirective
  | PriceDirective
  | NoteDirective
  | DocumentDirective
  | EventDirective

export type Entry = Directive | OptionEntry | PluginEntry | IncludeEntry

export interface ParseError {
  line: number // 0-based
  message: string
  severity: 'error'
}

export interface ParseResult {
  entries: Entry[]
  errors: ParseError[]
  /** options collected from `option "key" "value"` lines */
  options: Record<string, string>
}

export function isDirective(e: Entry): e is Directive {
  return e.type !== 'option' && e.type !== 'plugin' && e.type !== 'include'
}
