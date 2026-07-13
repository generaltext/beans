// Sample ledgers for the demo/tests.
//
// TINY_LEDGER is a hand-written fixture the unit tests assert exact numbers
// against. SAMPLE_LEDGER is a full year of a small consulting business, generated
// deterministically so the "Try it live" demo and standalone splash open onto a
// populated dashboard (net worth curve, monthly income/expense, expense mix).
// Balance assertions are computed from the running checking balance as the ledger
// is built, so they always hold — no hand-maintained magic numbers.

import { Dec } from './decimal'

export const TINY_LEDGER = `option "title" "Acme Co Books"
option "operating_currency" "USD"

2025-01-01 open Assets:Checking USD
2025-01-01 open Assets:Cash USD
2025-01-01 open Equity:Opening-Balances
2025-01-01 open Income:Consulting USD
2025-01-01 open Expenses:Software USD
2025-01-01 open Expenses:Office USD
2025-01-01 open Liabilities:CreditCard USD

2025-01-01 * "Opening balance"
  Assets:Checking                          10000.00 USD
  Equity:Opening-Balances

2025-01-05 * "Stripe" "Client invoice #1042" #consulting
  Assets:Checking                           4500.00 USD
  Income:Consulting

2025-01-08 * "GitHub" "Team plan"
  Expenses:Software                            21.00 USD
  Liabilities:CreditCard

2025-01-15 balance Assets:Checking          14500.00 USD

2025-01-20 * "Office Depot" "Printer paper & supplies"
  Expenses:Office                              64.30 USD
  Assets:Cash
`

// ---- Rich generated ledger -------------------------------------------------
//
// Three years of a growing consulting business (~500 transactions) so the demo
// opens onto full charts and a real net-worth curve. Deterministic (no random),
// and balance assertions are computed from the running checking balance as the
// ledger is built, so they always hold.

const CUR = 'USD'
const YEARS = [2023, 2024, 2025]
const f = (n: number) => n.toFixed(2)

type Posting = [account: string, amount: string | null]

function build(): string {
  const out: string[] = []
  let checking = Dec.ZERO

  const line = (s = '') => out.push(s)
  const col = (left: string, val: string) => left + ' '.repeat(Math.max(2, 48 - left.length - val.length)) + val

  function txn(date: string, payee: string | null, narr: string, tags: string[], postings: Posting[]) {
    line([date, '*', payee ? `"${payee}"` : null, `"${narr}"`, ...tags.map((t) => `#${t}`)].filter(Boolean).join(' '))
    for (const [acc, amt] of postings) {
      if (amt === null) line('  ' + acc)
      else {
        line(col('  ' + acc, `${amt} ${CUR}`))
        if (acc === 'Assets:Checking') checking = checking.add(Dec.parse(amt)!)
      }
    }
    line()
  }

  function assertChecking(date: string) {
    line(col(`${date} balance Assets:Checking`, `${checking.toFixed(2)} ${CUR}`))
    line()
  }

  line('option "title" "Northwind Consulting"')
  line('option "operating_currency" "USD"')
  line()
  line(';; Chart of accounts')
  for (const acc of [
    'Assets:Checking',
    'Assets:Savings',
    'Assets:Cash',
    'Liabilities:CreditCard',
    'Equity:Opening-Balances',
    'Income:Consulting',
    'Income:Sales',
    'Income:Other',
    'Expenses:Payroll',
    'Expenses:Rent',
    'Expenses:Software:Hosting',
    'Expenses:Software:Tools',
    'Expenses:Marketing',
    'Expenses:Travel',
    'Expenses:Meals',
    'Expenses:Office',
    'Expenses:Equipment',
    'Expenses:Insurance',
    'Expenses:Taxes',
    'Expenses:Fees',
  ]) {
    line(`${YEARS[0]}-01-01 open ${acc} ${CUR}`)
  }
  line()
  line(`${YEARS[0]}-01-01 commodity USD`)
  line('  name: "US Dollar"')
  line()

  txn(`${YEARS[0]}-01-01`, null, 'Opening balances', [], [
    ['Assets:Checking', f(18000)],
    ['Assets:Savings', f(8000)],
    ['Assets:Cash', f(600)],
    ['Equity:Opening-Balances', null],
  ])

  for (const year of YEARS) {
    const g = 1 + (year - YEARS[0]!) * 0.16 // ~16% growth per year
    for (let m = 1; m <= 12; m++) {
      const MM = String(m).padStart(2, '0')
      const d = (day: number) => `${year}-${MM}-${String(day).padStart(2, '0')}`
      const quarter = m % 3 === 0
      const even = m % 2 === 0

      txn(d(1), 'Highrise Properties', 'Office rent', [], [['Assets:Checking', f(-2200 * g)], ['Expenses:Rent', null]])
      txn(d(2), 'The Hartford', 'Business insurance', [], [['Liabilities:CreditCard', f(-145 * g)], ['Expenses:Insurance', null]])
      txn(d(3), 'GitHub', 'Team plan', ['saas'], [['Liabilities:CreditCard', f(-21)], ['Expenses:Software:Tools', null]])
      txn(d(5), 'Northwind Retainer', 'Monthly retainer', ['consulting'], [['Assets:Checking', f(7500 * g)], ['Income:Consulting', null]])
      txn(d(7), 'AWS', 'Cloud hosting', ['saas'], [['Liabilities:CreditCard', f(-(90 + m * 6) * g)], ['Expenses:Software:Hosting', null]])
      txn(d(9), 'Figma', 'Design tools', ['saas'], [['Liabilities:CreditCard', f(-45)], ['Expenses:Software:Tools', null]])
      txn(d(10), 'Corner Store', 'Office supplies', [], [['Assets:Cash', f(-(25 + (m % 4) * 5))], ['Expenses:Office', null]])
      txn(d(12), 'Blue Bottle', 'Team coffee', [], [['Liabilities:CreditCard', f(-(38 + (m % 5) * 4))], ['Expenses:Meals', null]])
      txn(d(15), 'Payroll', 'Salaries', [], [['Assets:Checking', f(-5800 * g)], ['Expenses:Payroll', null]])
      txn(d(15), 'Stripe', 'Processing fees', [], [['Assets:Checking', f(-(120 + m * 3) * g)], ['Expenses:Fees', null]])
      if (quarter) txn(d(16), 'IRS', 'Estimated quarterly tax', [], [['Assets:Checking', f(-3200 * g)], ['Expenses:Taxes', null]])
      if (even) txn(d(18), 'Google Ads', 'Campaign', ['marketing'], [['Liabilities:CreditCard', f(-320 * g)], ['Expenses:Marketing', null]])
      txn(
        d(20),
        even ? 'Contoso' : 'Fabrikam',
        even ? 'Project milestone' : 'Retainer top-up',
        [even ? 'sales' : 'consulting'],
        [['Assets:Checking', f((3000 + (m % 4) * 600) * g)], [even ? 'Income:Sales' : 'Income:Consulting', null]],
      )
      txn(d(22), 'Sweetgreen', 'Client lunch', [], [['Liabilities:CreditCard', f(-(42 + (m % 3) * 6))], ['Expenses:Meals', null]])
      if (m % 3 === 0)
        txn(d(24), 'Delta', 'Client onsite', ['travel'], [['Liabilities:CreditCard', f(-(720 + m * 12) * g)], ['Expenses:Travel', null]])
      txn(d(28), 'Card payment', 'Pay down credit card', [], [['Assets:Checking', f(-1400 * g)], ['Liabilities:CreditCard', f(1400 * g)]])

      // one-offs, scattered through the year
      if (m === 3) txn(d(11), 'Apple', 'New laptop', [], [['Liabilities:CreditCard', f(-2400)], ['Expenses:Equipment', null]])
      if (m === 5) txn(d(6), 'SaaStr', 'Conference tickets', ['travel'], [['Liabilities:CreditCard', f(-1200 * g)], ['Expenses:Travel', null]])
      if (m === 7) txn(`${year}-07-02`, null, 'Move to savings', [], [['Assets:Savings', f(6000 * g)], ['Assets:Checking', f(-6000 * g)]])
      if (m === 9) txn(d(14), 'Globex', 'Big project deposit', ['sales'], [['Assets:Checking', f(12000 * g)], ['Income:Sales', null]])
      if (m === 12) txn(d(20), 'Payroll', 'Year-end bonus', [], [['Assets:Checking', f(-4000 * g)], ['Expenses:Payroll', null]])
      if (m === 12) txn(d(23), 'State Tax Board', 'Tax refund', ['other'], [['Assets:Checking', f(900 * g)], ['Income:Other', null]])
    }
    assertChecking(`${year + 1}-01-01`)
  }

  line(`${YEARS[YEARS.length - 1]! + 1}-01-05 note Assets:Checking "Reconciled against January statement"`)

  return out.join('\n')
}

export const SAMPLE_LEDGER = build()
