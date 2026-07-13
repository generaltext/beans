// A lightweight CodeMirror 6 language for beancount, implemented as a
// StreamLanguage (a per-line tokenizer) rather than a full Lezer grammar — plenty
// for syntax highlighting, and it stays small. Token colors are driven by CSS
// custom properties (see global.css) so highlighting follows the shell's
// light/dark theme with no JS reconfiguration.

import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const KEYWORDS =
  /^(open|close|commodity|balance|pad|price|note|document|event|query|custom|option|plugin|include|pushtag|poptag|txn)\b/

const beancountMode = StreamLanguage.define<{ inCost: boolean }>({
  name: 'beancount',
  startState: () => ({ inCost: false }),
  token(stream) {
    if (stream.eatSpace()) return null
    const ch = stream.peek()

    // line comments: ; ... and org-mode headings (* / # at col 0)
    if (ch === ';' || (stream.sol() && (ch === '*' || ch === '#') && /[*#]\s/.test(stream.string.slice(stream.pos, stream.pos + 2)))) {
      stream.skipToEnd()
      return 'comment'
    }

    // strings
    if (ch === '"') {
      stream.next()
      let c: string | void
      while ((c = stream.next()) != null) {
        if (c === '\\') stream.next()
        else if (c === '"') break
      }
      return 'string'
    }

    // dates (must come before number)
    if (stream.match(/^\d{4}[-/]\d{2}[-/]\d{2}/)) return 'date'

    // tags and links
    if (stream.match(/^[#^][A-Za-z0-9\-_/.]+/)) return 'tag'

    // transaction / posting flags
    if (stream.match(/^[*!&?%](?=\s)/)) return 'flag'

    // keywords / directives
    if (stream.match(KEYWORDS)) return 'keyword'

    // accounts (uppercase root + at least one :segment) — before currency
    if (stream.match(/^[A-Z][A-Za-z0-9\-]*(?::[A-Z0-9][A-Za-z0-9\-]*)+/)) return 'account'

    // numbers
    if (stream.match(/^[-+]?[\d,]+(?:\.\d+)?/)) return 'number'

    // currencies / commodities
    if (stream.match(/^[A-Z][A-Z0-9'._-]*[A-Z0-9]|^[A-Z]\b/)) return 'currency'

    // metadata keys
    if (stream.match(/^[a-z][a-zA-Z0-9\-_]*:/)) return 'meta'

    // cost / price punctuation
    if (stream.match(/^(@@|@|\{\{|\}\}|\{|\})/)) return 'operator'

    stream.next()
    return null
  },
  tokenTable: {
    date: t.labelName,
    account: t.className,
    currency: t.unit,
    flag: t.keyword,
    tag: t.tagName,
    string: t.string,
    comment: t.lineComment,
    number: t.number,
    meta: t.propertyName,
    keyword: t.keyword,
    operator: t.operator,
  },
  languageData: { commentTokens: { line: ';' } },
})

// Colors reference CSS variables defined in global.css (which switch with the
// `.dark` class), so a single style serves both themes.
const beancountHighlight = HighlightStyle.define([
  { tag: t.labelName, color: 'var(--cm-date)' },
  { tag: t.className, color: 'var(--cm-account)' },
  { tag: t.unit, color: 'var(--cm-currency)' },
  { tag: t.keyword, color: 'var(--cm-keyword)', fontWeight: '600' },
  { tag: t.string, color: 'var(--cm-string)' },
  { tag: t.lineComment, color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: t.number, color: 'var(--cm-number)' },
  { tag: t.tagName, color: 'var(--cm-tag)' },
  { tag: t.propertyName, color: 'var(--cm-meta)' },
  { tag: t.operator, color: 'var(--cm-op)' },
])

export function beancount() {
  return [beancountMode, syntaxHighlighting(beancountHighlight)]
}
