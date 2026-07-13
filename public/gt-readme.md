# Beans

Plain-text, double-entry accounting for your team — a friendly UI over the
[beancount](https://beancount.github.io/docs/) format, with no terminal required.

Beans keeps your books in a single plain-text file, `v0/main.beancount`, that's
fully beancount-compatible. Bring an existing ledger and it just works; export any
time and take it with you. Because it's the real beancount format, your file stays
readable by beancount, Fava, your editor, `git`, and your AI — Beans is just a nicer
way in.

## What you get

- **A transaction register** with search, tags, and one-click add — account
  autocomplete and automatic balancing, so you don't hand-align columns.
- **Reports** — a live balance sheet and income statement, computed with exact
  decimal math (no floating-point cents drift).
- **Double-entry validation** — every transaction must balance; `balance`
  assertions are checked; problems are listed with line numbers.
- **The raw file, always** — a Source tab shows the exact `.beancount` text, fully
  editable. Structured edits and raw edits are the same file.

## Files it writes

- `v0/main.beancount` — your ledger, in standard beancount syntax.

Everything is local-first and syncs across your devices and collaborators through
General Text. There's no server holding your books.

## Not yet (first pass)

Cost-basis lot tracking and multi-currency price conversion in reports are planned
follow-ups; CSV/bank import is a fast-follow. The parser and reports handle
multiple commodities today, just not lot-level cost accounting.
