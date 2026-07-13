# Beans

Plain-text, double-entry accounting built as a [General Text](https://www.generaltext.org)
app — a friendly UI over the [beancount](https://beancount.github.io/docs/) format, with
no terminal required. Beans is a **pure-TypeScript implementation of the beancount
protocol** (parser + double-entry engine + reports) plus a modern UI: a transaction
register, live balance sheet / income statement / trial balance, a Fava-style dashboard,
and a real CodeMirror source editor.

Your books stay in a plain `.beancount` file you own — bring an existing ledger and it
just works; export any time. A workspace can hold several ledgers (one per financial
entity).

Built against the app guide: https://www.generaltext.org/llms.txt
(local source: `projects/generaltext/content/docs/building-apps.md`). Design plan:
`planning/apps/beans/init.md` in the gt-meta repo.

## Develop

```bash
pnpm install
pnpm dev        # vite dev server; window.gt is injected in dev
pnpm test       # vitest — the beancount parser + engine
pnpm typecheck
pnpm build      # tsc --noEmit && vite build → dist/ (gt.json at root, relative assets)
```

In dev, a tiny Vite plugin injects the public General Text runtime, so the app runs
standalone against a **local in-browser workspace** (IndexedDB + cross-tab sync). Open
two tabs to watch edits merge. No account, no server. To test inside real General Text,
`vite preview` and install by URL (Settings → Apps → Install by URL).

## Architecture

The canonical data **is** a real beancount file. Structured edits (add/delete a
transaction) are applied to the text by **line range**, so untouched entries keep their
exact formatting — no reserialize churn. Everything else is derived by parsing.

- **`src/beancount/`** — the engine, dependency-free and unit-tested:
  - `decimal.ts` — BigInt-backed arbitrary-precision decimal (exact money math).
  - `parse.ts` — line-oriented parser recording each entry's source span.
  - `engine.ts` — weights, double-entry validation, elided-posting inference,
    per-currency balances, `balance` assertions, date-range balances.
  - `reports.ts` / `series.ts` — account-tree aggregation and time-series for charts.
  - `print.ts` — format new entries for append; range append/remove helpers.
- **`src/hooks/use-ledger.ts`** — the data layer: discovers the workspace's
  `v0/*.beancount` ledgers, tracks the active one, parses + realizes on every change,
  and edits by range through `window.gt`.
- **`src/components/`** — Overview (dashboard, recharts), Transactions register,
  Reports, Journal, and the CodeMirror Source editor (`src/editor/beancount-lang.ts`).

## Ledgers = entities

Each ledger is one `.beancount` file under this app's `data/` (`v0/<name>.beancount`).
A workspace can hold several — personal, a business, a client — and the header switcher
moves between them. A ledger's display name comes from its `option "title"`.

## Files written (under this app's `data/`)

- `v0/main.beancount` — the default ledger, in standard beancount syntax.
- `v0/<name>.beancount` — additional ledgers you create or import.

Nothing else. The files are portable beancount you can open with beancount, Fava, your
editor, `git`, or your AI.

## License

MIT — see [LICENSE](./LICENSE).
