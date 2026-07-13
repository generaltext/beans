// Arbitrary-precision decimal for money. Floats can't represent 0.1 exactly, so
// summing postings and checking they net to zero has to be exact. We back a value
// with a BigInt mantissa and an integer scale (number of decimal places):
// value = mantissa * 10^-scale. Small, dependency-free, and enough for the
// beancount arithmetic we do (add / negate / compare / format).

export class Dec {
  // value === mantissa / 10^scale ; scale >= 0
  readonly mantissa: bigint
  readonly scale: number

  constructor(mantissa: bigint, scale: number) {
    this.mantissa = mantissa
    this.scale = scale
  }

  static readonly ZERO = new Dec(0n, 0)

  /** Parse a beancount number: optional sign, digits, thousands commas, decimals.
   *  Returns null if the string isn't a plain number. */
  static parse(raw: string): Dec | null {
    const s = raw.trim().replace(/,/g, '')
    if (!/^[+-]?(\d+)(\.\d+)?$|^[+-]?\.\d+$/.test(s)) return null
    const neg = s.startsWith('-')
    const body = s.replace(/^[+-]/, '')
    const dot = body.indexOf('.')
    if (dot === -1) return new Dec(BigInt((neg ? '-' : '') + body), 0)
    const intPart = body.slice(0, dot)
    const fracPart = body.slice(dot + 1)
    const digits = (intPart + fracPart).replace(/^0+(?=\d)/, '')
    const m = BigInt((neg ? '-' : '') + (digits === '' ? '0' : digits))
    return new Dec(m, fracPart.length)
  }

  private static align(a: Dec, b: Dec): [bigint, bigint, number] {
    if (a.scale === b.scale) return [a.mantissa, b.mantissa, a.scale]
    const scale = Math.max(a.scale, b.scale)
    const am = a.mantissa * 10n ** BigInt(scale - a.scale)
    const bm = b.mantissa * 10n ** BigInt(scale - b.scale)
    return [am, bm, scale]
  }

  add(other: Dec): Dec {
    const [am, bm, scale] = Dec.align(this, other)
    return new Dec(am + bm, scale)
  }

  sub(other: Dec): Dec {
    const [am, bm, scale] = Dec.align(this, other)
    return new Dec(am - bm, scale)
  }

  neg(): Dec {
    return new Dec(-this.mantissa, this.scale)
  }

  abs(): Dec {
    return this.mantissa < 0n ? this.neg() : this
  }

  /** Multiply by another decimal (used for cost/price weights). */
  mul(other: Dec): Dec {
    return new Dec(this.mantissa * other.mantissa, this.scale + other.scale)
  }

  isZero(): boolean {
    return this.mantissa === 0n
  }

  isNeg(): boolean {
    return this.mantissa < 0n
  }

  /** -1 / 0 / 1 */
  cmp(other: Dec): number {
    const [am, bm] = Dec.align(this, other)
    return am < bm ? -1 : am > bm ? 1 : 0
  }

  /** |this| <= |tolerance| — used for balance/assertion checks. */
  withinTolerance(tolerance: Dec): boolean {
    return this.abs().cmp(tolerance.abs()) <= 0
  }

  /** Render with the value's own scale (round-trips a parsed number faithfully). */
  toString(): string {
    return this.toFixed(this.scale)
  }

  /** Render with exactly `places` decimals (banker-free half-up rounding). */
  toFixed(places: number): string {
    let m = this.mantissa
    let scale = this.scale
    if (places < scale) {
      // round to `places`
      const drop = 10n ** BigInt(scale - places)
      const neg = m < 0n
      let q = (neg ? -m : m) + drop / 2n
      q = q / drop
      m = neg ? -q : q
      scale = places
    } else if (places > scale) {
      m = m * 10n ** BigInt(places - scale)
      scale = places
    }
    const neg = m < 0n
    let digits = (neg ? -m : m).toString()
    if (scale === 0) return (neg ? '-' : '') + digits
    if (digits.length <= scale) digits = digits.padStart(scale + 1, '0')
    const intPart = digits.slice(0, digits.length - scale)
    const fracPart = digits.slice(digits.length - scale)
    return (neg ? '-' : '') + intPart + '.' + fracPart
  }

  toNumber(): number {
    return Number(this.toString())
  }
}

/** Sum a list; empty sums to zero. */
export function sumDec(xs: Dec[]): Dec {
  return xs.reduce((acc, x) => acc.add(x), Dec.ZERO)
}

/** The default beancount balance tolerance for a set of amounts: half of the
 *  smallest decimal place seen (e.g. amounts to 0.01 → tolerance 0.005). With no
 *  fractional amounts, tolerance is 0. */
export function inferTolerance(scales: number[]): Dec {
  const maxScale = scales.length ? Math.max(...scales) : 0
  if (maxScale === 0) return Dec.ZERO
  return new Dec(5n, maxScale + 1) // 0.5 * 10^-maxScale
}
