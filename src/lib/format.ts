import type { Dec } from '~/beancount'

/** Insert thousands separators into the integer part of a decimal string. */
function group(s: string): string {
  const neg = s.startsWith('-')
  const body = neg ? s.slice(1) : s
  const dot = body.indexOf('.')
  const intPart = dot === -1 ? body : body.slice(0, dot)
  const rest = dot === -1 ? '' : body.slice(dot)
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '-' : '') + grouped + rest
}

/** "1,234.50 USD" — grouped, tabular. Uses the value's own precision. */
export function fmtAmount(n: Dec, currency: string): string {
  return `${group(n.toString())} ${currency}`
}

/** Just the number, grouped (currency shown separately). */
export function fmtNumber(n: Dec): string {
  return group(n.toString())
}

/** Render a currency→amount map as a list of "1,234.50 USD" strings, skipping
 *  zeros. Empty (all zero) renders as a single "0". */
export function fmtBalances(byCurrency: Map<string, Dec>): string[] {
  const out: string[] = []
  for (const [cur, v] of [...byCurrency].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!v.isZero()) out.push(fmtAmount(v, cur))
  }
  return out.length ? out : ['0']
}
