# Game of Cards — Build Plan

> Living document. Updated whenever the architecture or build order changes.
> Companion docs: `docs/DESIGN.md` (visual system), `docs/DECISIONS.md` (product/tech
> decisions), `docs/RULES_DECISIONS.md` (rule variants taught), `PROGRESS.md` (status),
> `CLAUDE.md` (commands and conventions).

## 0. Goals in one paragraph

A first-time visitor says "wow" within 10 seconds (animated card-dealing hero, cinematic
felt-and-gold look) and plays a real hand of a game they never heard of within 2 minutes
(one-click "Start learning" → 60-second primer → coached Blackjack hand). Every game has a
lesson, an interactive coached example, and a quiz; 12 games are fully playable against
bots with pretend currency (Jeet); wins earn filmy titles, losses earn gentle roasts plus a
real tip. A community board, contact form and admin view round it out.

## 1. Tech stack (pinned at scaffold time)

| Concern        | Choice                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, React 19, Server Components by default)           |
| Language       | TypeScript `strict` + `noUncheckedIndexedAccess`                          |
| Styling        | Tailwind CSS v4 (CSS-first `@theme` tokens in `src/app/globals.css`)      |
| Motion         | `motion` (Framer Motion) with a global reduced-motion switch              |
| State          | Zustand 5 + `persist` middleware (localStorage)                           |
| Validation     | Zod 4 (content schema, API payloads)                                      |
| Database       | Drizzle ORM. SQLite via `@libsql/client` locally (`file:./data/dev.db`); Postgres via `postgres` driver when `DATABASE_URL` starts with `postgres` |
| Tests          | Vitest (+ jsdom + React Testing Library), Playwright (Chromium)           |
| Quality        | ESLint (flat config, next + typescript), Prettier, `tsc --noEmit`         |
| Perf audit     | Lighthouse CLI against `next start`                                       |

No external fonts are fetched at runtime: fonts are self-hosted through `next/font/google`
(downloaded at build time) with a system-font fallback stack if the download fails.

## 2. Site map

```
/                         Landing: animated hero, CTAs, "Pick a game for me", featured games
/basics                   Card basics primer (60s, interactive, skippable)
/games                    Catalog with filters (region, difficulty, players, type, tier)
/games/[slug]             Game hub (SEO page): hook, facts, how-to steps, glossary, mistakes,
                          variants, CTA buttons → learn / try / play / quiz
/games/[slug]/learn       Lesson player (one concept per screen)
/games/[slug]/try         Interactive example hand with Coach panel
/games/[slug]/play        Tier 1 only: full game vs bot with Jeet betting
/games/[slug]/quiz        5-question quiz
/journey                  "Your learning journey" map + per-game progress
/stats                    Profile: wallet, stats, streaks, Awards Shelf (titles), share cards
/community                Community Board (posts, upvotes, comments, sort, filter)
/community/[id]           Single post with comments
/contact                  About the creator + GitHub + email + contact form
/admin                    Password-gated moderation (posts, comments, contact messages, ratings)
/api/...                  Route handlers (see §8)
/sitemap.xml, /robots.txt, /opengraph-image (generated), /games/[slug]/opengraph-image
```

Global chrome on every page: header (wordmark, nav: Games · Journey · Community · Contact,
wallet pill, sound toggle, settings), footer (links, pretend-money notice, GitHub, email),
floating **Feedback** button (opens a sheet that posts to the Community Board), toast
region, screen-reader live region.

## 3. Page wireframes (in words)

**Landing `/`**
- Full-bleed green-felt hero with a soft spotlight vignette and film-grain overlay.
- Center: the *Game of Cards* wordmark (original: stacked serif "GAME of CARDS" inside a
  marquee frame with bulb dots), tagline "Learn every card game. The fun way."
- Behind/around it: a deck of SVG cards that fans out, riffle-shuffles, then deals five cards
  into an arc (CSS/motion, ~2.5s, reduced-motion = static fan).
- Primary CTA: **Start learning in 2 minutes** → `/basics?next=/games/blackjack/try`.
- Secondary: **Pick a game for me** → 3-question modal (players / mood / time) → result card
  with "Learn it" button.
- Wallet teaser: "You start with 1,000 Jeet (pretend money)".
- "Now showing" strip: 6 featured game posters (cards with flag badge, difficulty, hook).
- "How it works" 4-step strip: Discover → Learn → Try → Play, with mini icons.
- Footer.

**Catalog `/games`**: filter bar (chips: region, type, difficulty 1–5, players, "Playable vs
bot" toggle), search box, responsive poster grid. Each poster: title, flag badge, type,
players, difficulty pips, length, hook, progress ribbon (not started / learning / learned /
mastered). Empty state with "reset filters".

**Game hub `/games/[slug]`**: hero band with game name, origin badge, quick facts row
(players, deck, difficulty, length), hook, fun-history card, step buttons
(Learn → Try → Play → Quiz) showing completion ticks, then indexable content: the rules
steps as text, glossary, beginner mistakes, variants note. JSON-LD `Game` structured data.

**Lesson `/games/[slug]/learn`**: top progress bar ("Step 3 of 8"), center stage with an
animated card scene, below it the explanation text with glossary terms underlined
(popover on tap/focus), optional tip bubble. Back / Next buttons, ← → keys. Final screen:
"You've got the basics!" with buttons Try an example / Take the quiz.

**Try `/games/[slug]/try`**: table area + Coach panel (side on desktop, bottom sheet on
mobile). Coach shows: what's happening, your legal moves (highlighted on table), "Why?" on
any attempted illegal move, "What would a pro do?" button. Tier 1 runs the real engine on a
curated seed; Tier 2 runs the scripted step-through (decision points with feedback).
Completion → mark "learning", CTA to Play / Quiz, lesson rating prompt.

**Play `/games/[slug]/play`**: Bet panel (chip buttons, min/max, wallet check, Daily Udhaar
offer when broke) → table with bot persona seats (avatar, name, "thinking…" dots), turn
indicator, action bar (buttons all keyboard reachable). End: full-screen celebration (title
reveal, confetti, card shower, Jeet count-up, Share, Play again) or roast overlay (comic
animation, roast line, tip, Rematch). Then "How was this lesson?" stars.

**Quiz `/games/[slug]/quiz`**: one question per screen, 4 options, instant feedback with
explanation, score at end, saves best score; 5/5 + a win = "mastered".

**Journey `/journey`**: a winding path (SVG road across a felt map) with a node per game in
recommended order; node color/ribbon = status; summary counters.

**Stats `/stats`**: wallet card, stat tiles (played, wins, losses, win rate, biggest win,
current/best streak), per-game table, Awards Shelf (title "posters", each with Share →
canvas PNG download / Web Share), reset-progress button (confirm dialog).

**Community `/community`**: "New post" form (type, title, description, optional name/email,
hidden honeypot), list with sort (Newest / Most upvoted), filter chips by type, each item
shows type badge, status badge (Planned / In progress / Done), upvote button with count,
comment count. Post page shows comments and an add-comment form.

**Contact `/contact`**: creator card (avatar initials, bio from `content/about.ts`),
GitHub button (new tab, `rel="noopener noreferrer"`), email `mailto:` + Copy email button
(toast "Email copied!"), contact form (name, email, message, honeypot).

**Admin `/admin`**: login form → tabs: Posts (status dropdown, delete), Comments (delete),
Messages (contact form inbox, mark read, delete), Ratings (table + averages per game).

## 4. Source layout

```
content/
  about.ts               Creator bio (the ONE allowed placeholder) — edit freely
  titles.ts              40+ win titles, 40+ roasts (with tags/conditions)
  games/<slug>.ts        One content file per game (validated by Zod)
  games/index.ts         GENERATED list of all content modules (scripts/gen-registry.ts)
docs/                    PLAN, DESIGN, DECISIONS, RULES_DECISIONS, screenshots/
drizzle/sqlite/, drizzle/pg/   SQL migrations per dialect (drizzle-kit generate)
scripts/
  gen-registry.ts        Scans content/games + src/games and writes generated registries
  validate-content.ts    Zod-validates every content file (runs in prebuild + tests)
  migrate.ts, seed.ts    DB migrate + seed sample posts
  lighthouse.mjs, screenshots.ts
src/
  app/                   Routes (see §2), layout.tsx, globals.css, sitemap.ts, robots.ts
  components/
    cards/               PlayingCard (SVG), CardBack, Suit glyphs, Hand, Pile, CardScene
    layout/              Header, Footer, Wordmark, WalletPill, SoundToggle, SettingsMenu,
                         FeedbackButton, SkipLink, LiveAnnouncer
    ui/                  Button, Dialog, Sheet, Toast, Tabs, Chip, Stars, Progress, Popover
    landing/             Hero (deck animation), PickAGame, FeaturedGames, HowItWorks
    learn/               LessonPlayer, GlossaryText, QuizRunner, ScriptedExample, CoachPanel
    play/                GameShell, BetPanel, Seat, BotAvatar, ResultOverlay(Celebration|Roast),
                         ShareCard, RatingPrompt, ThinkingDots
    community/, admin/, contact/, stats/, journey/
  games/
    core/                types.ts (Engine interface), cards.ts, rng.ts, deck.ts, util.ts,
                         simulate.ts (generic bot-vs-bot harness), registry.generated.ts
    <slug>/engine.ts     Pure rules (no UI/IO)
    <slug>/engine.test.ts + <slug>/simulation.test.ts
    <slug>/Board.tsx     Table UI for this game (client component)
    <slug>/index.ts      Exports the GameModule {engine, Board, betting, bots, practice}
  lib/
    content/schema.ts    Zod content schema + defineGame()
    content/catalog.ts   Typed catalog access + filters
    titles.ts            pickTitle / pickRoast (context-aware, no back-to-back repeats)
    share-card.ts        Canvas share-image renderer
    sound.ts             WebAudio synthesized card/coin sounds
    i18n/                en.ts dictionary + t() (Hindi-ready)
    recommend.ts         "Pick a game for me" scorer
  store/                 wallet.ts, stats.ts, progress.ts, settings.ts (Zustand persist)
  server/
    db/                  schema.sqlite.ts, schema.pg.ts, client.ts (dialect switch + lazy migrate)
    repo.ts              Data access functions used by route handlers
    security.ts          rate limiter, honeypot, sanitize, admin session (HMAC cookie)
    validation.ts        Zod payload schemas
e2e/                     Playwright specs
```

## 5. Engine interface (`src/games/core/types.ts`)

All engines are pure, synchronous, serializable-state modules.

```ts
type PlayerId = number;                     // 0 = human seat in play mode
type Difficulty = 'easy' | 'normal';

interface Rng { next(): number; int(maxExclusive: number): number; getState(): number }
// createRng(seed) → mulberry32; rngFromState(state) restores; shuffle(arr, rng) = Fisher–Yates

interface GameConfig {
  players: number;                          // seats incl. human
  stake: number;                            // Jeet units the human committed (1 unit = base bet)
  affordableUnits?: number;                 // how many extra units the wallet can cover
  [k: string]: unknown;                     // game-specific options
}

interface MoveCheck { ok: boolean; reason?: string }   // reason = beginner-friendly "why"

interface GameResult {
  winners: PlayerId[];
  humanOutcome: 'win' | 'loss' | 'push';
  humanNetUnits: number;                    // + won / − lost, in stake units (× stake = Jeet)
  scores?: number[];
  summary: string;                          // plain-English line for the result screen
  flags: ResultFlags;                       // comeback, closeFinish, luckyLastCard, bigPot,
                                            // blackjack, perfect, bust, folded, ...
}

interface GameEngine<S, M> {
  id: string;
  setup(config: GameConfig, rng: Rng): S;
  currentPlayer(state: S): PlayerId | null;  // whose decision it is (null when over)
  legalMoves(state: S, player: PlayerId): M[];
  checkMove(state: S, player: PlayerId, move: M): MoveCheck;  // explains illegal moves
  applyMove(state: S, move: M): S;          // pure; throws IllegalMoveError if !checkMove
  isOver(state: S): boolean;
  result(state: S): GameResult;
  botMove(state: S, player: PlayerId, difficulty: Difficulty, rng: Rng): M;
  describeMove(state: S, player: PlayerId, move: M): string;   // screen-reader announcement
  coach(state: S, player: PlayerId): CoachAdvice;  // { situation, suggestion?, why? }
  moveKey(move: M): string;                 // stable id for comparing/highlighting moves
}
```

Rules:
- All randomness happens through `Rng`. When a game needs randomness after setup (e.g. a
  new deal in a multi-hand match) it stores `rngState: number` in its state and restores it
  with `rngFromState` — `applyMove` stays a pure function of `(state, move)`.
- Hidden information is part of state; the UI decides what to reveal. Bots must only use
  information their seat could legally know (enforced by code review + tests where cheap).
- `applyMove` never mutates its input (tests deep-freeze states to prove it).
- Every engine ships: rule unit tests + `simulation.test.ts` running ≥1,000 seeded
  bot-vs-bot games asserting: no throws, every bot move ∈ legalMoves, game terminates within
  a move cap, conservation invariants (card counts, chip totals) and scoring correctness.
- A generic harness `simulate(engine, config, seeds, opts)` in `core/simulate.ts` does the
  loop; per-game tests add game-specific invariants.

`GameModule` (`src/games/<slug>/index.ts`) bundles the engine with UI + metadata:

```ts
interface GameModule<S, M> {
  slug: string;
  engine: GameEngine<S, M>;
  Board: React.ComponentType<BoardProps<S, M>>;   // renders state, emits moves
  betting: { minStake; maxStake; stakeOptions: number[]; maxLossUnits; describe: string };
  bots: BotPersona[];                              // original characters, name + avatar spec
  defaultConfig: Omit<GameConfig, 'stake'>;
  practice: { seed: number; config?: Partial<GameConfig>; intro: string };  // coached hand
}
```

Tier is derived, never declared: a game is Tier 1 iff a `GameModule` exists for its slug.
Upgrading a Tier 2 game = add `src/games/<slug>/` + run `npm run gen` — its content file is
untouched (it keeps its scripted example as an extra "walkthrough").

## 6. Content schema (`src/lib/content/schema.ts`, Zod)

```ts
GameContent = {
  slug, name, aka?: string[],
  origin: { country, countryCode /* ISO-2 for flag emoji */, region: Region },
  type: 'trick-taking'|'shedding'|'rummy'|'comparing'|'solitaire'|'casino'|'fishing'|'beating',
  players: { min, max, ideal? }, deck: string, difficulty: 1..5, length: string,
  hook: string, history: string, featured?: boolean, order: number /* journey order */,
  variantTaught: string, variants: string,
  glossary: { term, definition }[],                    // terms referenced as [[term]] in text
  lesson: { title, body, scene?: Scene, tip? }[],      // 5–12 screens
  mistakes: string[], tips: string[] /* used after roasts */,
  quiz: { question, options: string[4], answer: index, explanation }[5],
  example?: { intro, steps: ScriptedStep[] },          // required when no engine (Tier 2)
  seo: { description }
}
Scene = { zones: { id, label?, cards: CardSpec[], layout: 'fan'|'row'|'stack'|'grid',
          highlight?: number[], faceDown?: number[] }[], caption?, animate?: 'deal'|'flip'|'none' }
ScriptedStep = { narration, scene, decision?: { prompt, options: { label, card?, correct,
                 feedback }[], proHint } }
CardSpec = 'AS' | 'TD' | '7H' | 'JK' ... (rank A23456789TJQK + suit SHDC; JK = joker)
```

Validation: `scripts/validate-content.ts` (runs in `prebuild`, `npm run validate`, and a
Vitest test) also cross-checks: every `[[term]]` exists in the glossary, quiz has exactly 5
questions, answer index in range, card codes valid, Tier 2 games have `example`, slug matches
filename. A failing content file fails `npm run build`.

## 7. Client state (Zustand, persisted under `goc:*` keys)

- `wallet`: `balance` (start 1000), `lastUdhaarAt`, `ledger` (last 50 entries), actions
  `placeBet`, `settle`, `claimUdhaar` (only if balance < 100 and 24h elapsed; +500).
- `stats`: played, wins, losses, pushes, biggestWin, currentStreak, bestStreak, perGame,
  awards `{ id, titleId, text, gameSlug, jeet, at }[]`, `lastTitleId`, `lastRoastId`.
- `progress`: per game `{ lessonDone, exampleDone, quizBest, wins, status }` where status =
  not-started → learning (opened lesson/example) → learned (lesson + example + quiz ≥ 3) →
  mastered (quiz 5/5 and ≥ 1 win, or quiz 5/5 for Tier 2).
- `settings`: `muted` (true on first load), `fourColor`, `motion` ('system'|'reduce'|'full'),
  `botSpeed`, `primerSeen`, `locale` ('en'), `voterToken` (random UUID).
Hydration: stores use `skipHydration` + a `<StoreHydrator/>` to avoid SSR mismatch; the
wallet pill renders a skeleton until hydrated.

## 8. Backend

**DB schema** (identical shape in `schema.sqlite.ts` and `schema.pg.ts`):

```
posts(id pk, type, title, body, author_name?, author_email?, status default 'open',
      upvotes int default 0, comment_count int default 0, ip_hash, created_at)
comments(id pk, post_id fk→posts cascade, body, author_name?, ip_hash, created_at)
votes(id pk, post_id fk cascade, voter_token, ip_hash, created_at,
      UNIQUE(post_id, voter_token))
contact_messages(id pk, name, email, message, ip_hash, read bool, created_at)
lesson_ratings(id pk, game_slug, stars 1..5, comment?, ip_hash, created_at)
```

**Routes** (`src/app/api/**/route.ts`):
- `GET /api/posts?sort=new|top&type=` · `POST /api/posts`
- `GET /api/posts/[id]` · `POST /api/posts/[id]/vote` (toggle, unique per voter token)
- `POST /api/posts/[id]/comments`
- `POST /api/contact` · `POST /api/ratings`
- `POST /api/admin/login` · `POST /api/admin/logout`
- `GET /api/admin/overview` · `PATCH|DELETE /api/admin/posts/[id]` · `DELETE /api/admin/comments/[id]`
  · `PATCH|DELETE /api/admin/messages/[id]`

**Protection**: Zod length limits, server-side validation, honeypot field `website` (if
filled → 200 fake-success, nothing stored), sliding-window rate limit per IP (in-memory,
e.g. 5 writes/min, 30 votes/min), `sanitize-html` with no allowed tags on every text field
(plus React escaping on render), IPs stored only as salted SHA-256 hashes, admin session =
HMAC-signed httpOnly SameSite=Strict cookie derived from `ADMIN_PASSWORD`, timing-safe
password compare, admin disabled entirely when `ADMIN_PASSWORD` is unset.

**Dialect switch**: `DATABASE_URL` unset or `file:` → libsql/SQLite; `postgres://` → postgres
driver. Migrations live in `drizzle/sqlite` and `drizzle/pg`; `db:migrate` applies the right
set, and the server lazily runs migrations on first connection so `npm run dev` works on a
fresh clone. `db:seed` inserts a few sample posts (idempotent). The Postgres path is tested
in Vitest with PGlite (in-process Postgres) running the same repository functions.

## 9. Personality systems

- `content/titles.ts`: ≥ 40 titles `{ id, text, film, when: Condition[], weight }` and ≥ 40
  roasts `{ id, text, film, when: Condition[] }` spanning Bollywood, Hollywood and South
  Indian cinema (names, characters, short catchphrases only).
- Conditions: `firstWin`, `streak>=3`, `comeback`, `bigPot`, `biggestWin`, `closeFinish`,
  `luckyLastCard`, `blackjack`, `perfect`, `game:<slug>`, `generic`; roast conditions:
  `bust`, `folded`, `bigLoss`, `closeLoss`, `streakBroken`, `game:<slug>`, `generic`.
- `pickTitle(ctx, lastId, rng)`: score = specificity of matched conditions; choose among the
  top tier, never equal to `lastId`. Same for `pickRoast`. Tested for: context matching,
  no back-to-back repeat over 10k draws, counts ≥ 40, banned-topic word list.
- After every roast: one tip from that game's `tips` (rotating) + Rematch button.
- Share card: `renderShareCard({title, film, game, jeet, date})` draws a 1200×630 poster on
  canvas (felt background, gold frame, marquee bulbs, wordmark) → PNG blob → download or
  `navigator.share` with file.

## 10. Accessibility & UX rules

- Every interactive element is a real `<button>`/`<a>` with a visible focus ring.
- Card hands use a roving-tabindex listbox pattern: ←/→ move, Enter/Space play/select.
- Klondike keyboard: Tab between piles, Enter picks up the top movable run, Enter on a
  destination drops; Esc cancels; "Auto-move to foundation" button.
- Moves are announced through a polite `aria-live` region (`describeMove`).
- Cards have `aria-label` like "Queen of Hearts"; suits differ by shape; optional four-color
  deck (♠ black, ♥ red, ♦ blue, ♣ green).
- `prefers-reduced-motion` respected; user can override in settings.
- Contrast ≥ 4.5:1 for text on felt (gold #E9C46A-ish on deep green passes; verified).
- Mobile first: 375px portrait layouts verified via Playwright screenshots.

## 11. Testing strategy

- **Unit (Vitest)**: rng/shuffle fairness (chi-square on 60k shuffles), card utils, every
  engine's rules & edge cases, ≥1,000-game simulations per Tier 1 engine, titles/roasts
  selection, wallet/udhaar logic, recommender, content validation, security helpers,
  repository against SQLite (temp file) and Postgres (PGlite).
- **Component (RTL)**: PlayingCard labels, Hand keyboard navigation, WalletPill, LessonPlayer
  arrows, QuizRunner, ResultOverlay (title vs roast), Contact copy button, BetPanel limits.
- **E2E (Playwright)**: first visit → primer → first completed Blackjack hand; forced win →
  title shown; forced loss → roast + tip + Rematch; post feedback (+upvote, comment, filter,
  sort); contact message → visible in admin; admin status change + delete; keyboard-only
  Blackjack, Hearts, Klondike; every Tier 1 play page loads and completes a bot-assisted
  game; every Tier 2 try page completes; mobile 375px + desktop screenshots →
  `docs/screenshots/`.
- Deterministic E2E: pages accept `?seed=` (and engines are seeded) so tests can force a
  win/loss deal. Seeds are discovered by a script that simulates candidate seeds.

## 12. Build order (milestones; commit after each green one)

1. Scaffold, tooling, design system, layout, header wallet, footer, Contact section.
2. Card SVG components + animations, card basics primer.
3. Blackjack end-to-end (reference implementation): engine + tests + sim, content, lesson,
   coached hand, play with Jeet, titles/roasts, quiz, rating prompt.
4. Remaining Tier 1 games: Teen Patti, Andar Bahar, Indian Rummy, Texas Hold'em, Baccarat,
   Hearts, Spades, Crazy Eights, Go Fish, War, Klondike — each fully working.
5. Tier 2 games (19): content + scripted examples + quizzes.
6. Community Board, lesson ratings, contact form persistence, admin view.
7. Stats page, Awards Shelf, share cards, "Pick a game for me", Journey map.
8. Accessibility, performance (Lighthouse ≥ 90 ×4), SEO, screenshots, README, polish.

Parallelisation: after milestone 1–2 foundations exist, engines/boards (4) and Tier 2
content (5) are independent per game and are built by parallel agents that each own only
`src/games/<slug>/**` and `content/games/<slug>.ts`; shared files are only touched by the
integrator. Registries are generated (`npm run gen`) to avoid merge conflicts.
