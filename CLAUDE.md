# CLAUDE.md — Game of Cards

Learn-card-games website: Next.js 16 (App Router) + TypeScript strict + Tailwind v4 +
`motion` + Zustand + Zod + Drizzle (SQLite/Postgres). See `docs/PLAN.md` for architecture,
`docs/DESIGN.md` for the visual system, `docs/DECISIONS.md` and `docs/RULES_DECISIONS.md`
for decisions, `PROGRESS.md` for current status.

## Commands

| Command                           | What it does                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Generate registries, migrate DB, start dev server on :3000                                                                                                                                                                            |
| `npm run build` / `npm start`     | Production build (validates content first) / serve it                                                                                                                                                                                 |
| `npm run lint`                    | ESLint (zero warnings) + Prettier check                                                                                                                                                                                               |
| `npm run format`                  | Prettier write                                                                                                                                                                                                                        |
| `npm run typecheck`               | `tsc --noEmit`                                                                                                                                                                                                                        |
| `npm run test`                    | Vitest (unit, component, engine simulations)                                                                                                                                                                                          |
| `npx vitest run src/games/hearts` | Run one game's tests                                                                                                                                                                                                                  |
| `npm run e2e`                     | Playwright (builds + starts the app on :3100 automatically)                                                                                                                                                                           |
| `npm run gen`                     | Regenerate `content/games/index.ts`, `src/games/registry.generated.ts` (lazy game modules) and `src/games/slugs.generated.ts` (slug lists — server code imports this, never the registry, or every board lands in the landing bundle) |
| `npm run validate`                | Zod-validate all game content + titles                                                                                                                                                                                                |
| `npm run db:generate`             | Create SQL migrations for both dialects after editing the schema                                                                                                                                                                      |
| `npm run db:seed`                 | Insert sample Community Board posts                                                                                                                                                                                                   |
| `npm run lighthouse`              | Lighthouse audit of a running production server                                                                                                                                                                                       |

## Structure

- `content/games/<slug>.ts` — one content file per game (`defineGame({...})`, schema in
  `src/lib/content/schema.ts`). `content/titles.ts` — win titles & roasts.
  `content/about.ts` — creator bio (the only allowed placeholder text).
- `src/games/core/` — shared engine contract (`types.ts`), UI module contract
  (`module.ts`), cards, seeded RNG + Fisher–Yates, simulation harness.
- `src/games/<slug>/` — `engine.ts` (pure rules), `engine.test.ts`, `simulation.test.ts`,
  `Board.tsx` (table UI), `index.ts` (default-exports the `GameModule`). Presence of
  `index.ts` makes the game Tier 1.
- `src/components/` — `cards/`, `layout/`, `ui/`, `landing/`, `learn/`, `play/`,
  `community/`, `admin/`, `contact/`, `stats/`, `journey/`.
- `src/store/` — Zustand stores (wallet, stats, progress, settings), persisted to
  localStorage with `skipHydration` + `<StoreHydrator/>`; gate on `useHydrated()`.
- `src/server/` — DB (Drizzle), repository, security helpers. Route handlers in
  `src/app/api/**/route.ts`.
- `e2e/` — Playwright specs. `docs/screenshots/` — generated screenshots.

## Conventions

- **Engines are pure**: no React/DOM/IO, no `Math.random()`, no `Date.now()`. All
  randomness via the injected `Rng` (`createRng`, `rngFromState`, `shuffle`). State is plain
  JSON. `applyMove` never mutates input (the simulation harness deep-freezes states).
- Every Tier 1 engine has rule tests + a ≥ 1,000-game seeded `simulate()` test.
- Card codes are strings: rank `A23456789TJQK` + suit `SHDC` (`"TD"` = Ten of Diamonds),
  jokers `X1`/`X2`. Use helpers from `@/games/core/cards`.
- Next 16 specifics: route `params`/`searchParams` are **Promises** (`await props.params`);
  `middleware.ts` is now `proxy.ts`; there is no `next lint`. Local docs:
  `node_modules/next/dist/docs/`.
- Animations use `motion/react` and must respect reduced motion (`useReducedMotionPref()`
  from `@/lib/motion`).
- UI chrome strings go through `t()` from `@/lib/i18n` (Hindi-ready). Game content stays
  in content files.
- Accessible by default: real buttons, `aria-label` on cards, keyboard paths for every
  action, announcements via `announce()` from `@/components/layout/LiveAnnouncer`.
- Imports: `@/…` → `src/…`, `@content/…` → `content/…`. Type-only imports use
  `import { type X }`.
- First-load components (landing, header) must not import `motion/react`; per-game UI strings live in `src/games/<slug>/i18n.ts`.
- Never add real-money, purchase or payment features. Jeet is pretend money.
- Never skip, weaken or delete a test to make it pass — fix the root cause.
