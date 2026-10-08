# Blackjack — the reference Tier 1 game

Blackjack is the reference Tier 1 game. Copy its shape when you build another game: the
checklist below is what reviewers will hold your Board to.

| File                                                               | What it holds                                                                             | Owner          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------- |
| `engine.ts`, `hand.ts`, `strategy.ts` (+ tests, `test-helpers.ts`) | The pure rules: state, moves, legality reasons, settlement, `describeMove`, `coach`, bots | rules engineer |
| `Board.tsx`                                                        | The table UI. It implements `BoardProps<BlackjackState, BlackjackMove>`                   | UI             |
| `personas.ts`                                                      | The dealer, Dealer Sitara: an original character with a `BotPersona` avatar spec          | UI             |
| `seeds.ts`                                                         | Curated deals for practice, E2E and screenshots (`BLACKJACK_SEEDS`)                       | UI             |
| `index.ts`                                                         | Default-exports the `GameModule`. This file's existence makes the game Tier 1             | UI             |
| `src/lib/i18n/en/blackjack.ts`                                     | The Board's UI text, read through `t('blackjack.…')`                                      | UI             |

## Becoming Tier 1

1. `index.ts` default-exports `{ slug, engine, Board, betting, bots, defaultConfig, practice, difficulties?, moveLabel? }`.
2. Register your i18n namespace (`src/lib/i18n/en/<slug>.ts`) in `src/lib/i18n/en/index.ts`. This is the only shared file you edit.
3. Run `npm run gen`. It adds a lazy loader to `src/games/registry.generated.ts`, so your engine and Board ship in their own chunk. Never import `@/games/<slug>` from shared code; that would pull the chunk into every page.
4. `/games/<slug>/play` (GameShell) and `/games/<slug>/try` (PracticeHand) now load the module.

Module fields worth knowing:

- **`betting.maxLossUnits`** is the escrow taken before the deal (`stake × maxLossUnits`). At the end, the shell credits `escrow + round(net × stake)`, or debits the difference if that is negative. Leaving mid-hand forfeits exactly one stake. Blackjack uses `1`. Doubles and splits are settled afterwards, and the engine only allows them while `config.affordableUnits` (the extra stakes the wallet can cover, computed by the shell) allows them. A pot game whose learner can lose up to 4 stakes would use `4`.
- **`bots[i]` is seat `i + 1`.** Boards get `personas` indexed by seat: `personas[0]` is "You" and `personas[1]` is the dealer. So read `personas[seat]`, never `personas[seat - 1]`. A solitaire game has `bots: []`, and the shell then says "Just you and the deck".
- **`defaultConfig`** must be accepted by `engine.setup`. Blackjack requires exactly `{ players: 2 }`.
- **`practice.seed`** is a number. "Try another practice hand" uses `seed + 1`, `seed + 2`, and so on. Because of that, `practice.intro` must not describe one particular deal, and must not say "first".
- **`difficulties`** lists the bot levels offered in the bet panel. A single entry, like Blackjack's `['normal']`, hides the picker; the dealer has no choices to make.

## What the shell already does (don't rebuild it in your Board)

GameShell and PracticeHand wrap your Board in a `TableFrame` and provide:

- the game name, "You vs …", the bet chip and a Rules link (it opens in a new tab, so checking the rules never forfeits a stake);
- the turn pill: "Your turn", "Mona is thinking…", or "Dealer Sitara is playing…" when the bot has only one legal move;
- the illegal-move callout (`move-error`, `role="alert"`) in play mode, and in practice the coach panel with the situation, the error, "What would a pro do?" and the hint;
- the move log, and an announcement for every move (`engine.describeMove`, where "Player N" becomes the persona name);
- the escrow, the settlement, stats, awards, titles, roasts, tips, the result overlays and the rating prompt.

Your engine's words are used for that, so write them for a beginner:

- **`result(state).summary`** appears on the celebration, roast and push overlays and in the hand-over bar, and it is read out with the outcome. Write one complete, plain sentence that explains why the hand ended this way.
- **`coach(state, 0).situation`** is read out right after the deal. In practice it is also shown while bots play, even when it isn't the learner's turn. Describe only what seat 0 can see.
- **`checkMove(...).reason`** is the "why not?" text. Name the rule and say what the learner can do instead.

## A minimal Board

```tsx
'use client';
import { Hand } from '@/components/cards';
import { Seat } from '@/components/play/Seat';
import { type BoardProps } from '@/games/core/module';
import { t } from '@/lib/i18n';
import { engine, type MyMove, type MyState } from './engine';

export function MyBoard(props: BoardProps<MyState, MyMove>) {
  const {
    state,
    human,
    onMove,
    busy,
    thinking,
    coachMode,
    highlight,
    suggestedKey,
    personas,
    over,
  } = props;
  const mine = state.hands[human] ?? [];
  const keyOf = (i: number) => engine.moveKey({ type: 'play', card: mine[i]! });
  const suggested = mine.findIndex((_, i) => keyOf(i) === suggestedKey);
  return (
    <div data-testid="my-board" className="flex flex-col gap-4">
      {personas.slice(1).map((persona, i) => (
        <Seat
          key={persona.name}
          persona={persona}
          active={state.turn === i + 1 && !over}
          thinking={thinking === i + 1}
        >
          {/* Hidden cards: pass placeholder codes (or a count), never the real ones. */}
        </Seat>
      ))}
      <Hand
        cards={mine}
        label={t('mygame.zone.you')}
        onActivate={(card) => onMove({ type: 'play', card })} // any card: the controller explains illegal ones
        disabled={busy} // cards stay focusable but ignore presses
        highlighted={
          new Set(mine.flatMap((_, i) => (coachMode && highlight.has(keyOf(i)) ? [i] : [])))
        }
        suggested={suggested >= 0 ? suggested : null}
      />
    </div>
  );
}
```

`legalMoves` is empty when it isn't the learner's turn. `highlight` holds the `moveKey()` of every legal move, but only in coach mode. `suggestedKey` is set after "What would a pro do?".

## Board checklist (what `Board.tsx` does, and why)

- **Show only what the learner may see.** The face-down hole card is handed to `PlayingCard` as a placeholder code. A face-down `PlayingCard` never mounts its face, so the real card never reaches the DOM. Totals and zone labels come from `visibleDealerCards()`. The shoe is drawn with `CardBack`. `Board.test.tsx` checks that no hidden card shows up anywhere in the DOM.
- **Let the learner try any move.** Unavailable actions (for example Split without a pair) look secondary and carry `aria-disabled="true"`, plus a description saying "press it and the coach explains why". They stay focusable and still call `onMove`, and the controller then shows the engine's reason. While `busy`, presses are ignored, but the buttons keep focus. The real `disabled` attribute would drop focus to `<body>`.
- **Keyboard.** Everything works without a mouse. For card games, use `Hand`: it is a roving-tabindex toolbar where ←/→ move and Enter/Space play. Blackjack adds H, S, D and P shortcuts that work anywhere on the page, through one `window` keydown listener (`useEffectEvent`). They are skipped while typing in an input or textarea, inside another dialog, with Ctrl/Meta/Alt held, or on key repeat. Each button has `aria-keyshortcuts`, and a small legend lists the keys on pointer-fine devices.
- **Coach mode.** `coachMode && highlight.has(moveKey)` makes a button glow (`data-highlighted`). `suggestedKey` makes it pulse (`data-suggested`), with the description "The coach's pick". Outside coach mode nothing glows.
- **Screen readers.** Don't announce moves yourself; the controller already does. Label each zone with a group name such as "Dealer's hand: King of Spades and a face-down card" or "Your first hand: …", and mark the cards `decorative`. Total pills get a visually hidden "Your total:" / "Dealer total:" prefix.
- **Motion.** Cards fly from the shoe in casino order (learner, dealer, learner, hole card). Positions are measured, so this works at any width, and each card flips face up mid-flight. The dealer draws one card per forced move, paced by the controller's bot delay (`BOT_DELAY_MS[botSpeed]`, 60% of it for forced moves). After a split, the moved card slides to the second hand (`layoutId`). Every animation checks `useReducedMotionPref()`; with reduced motion, cards simply appear. The table remounts per deal (`roundKey`), so a restarted practice hand deals again.
- **StrictMode-safe.** No side effects inside `setState` updaters or render. Timers and listeners are cleaned up in the effect that made them.
- **Layout.** Mobile first: at 375 px the four action buttons sit in one row, every target is at least 44 px, and cards use `clamp()` widths with `rowLayout()` overlap, so any number of cards fits. A seat's "Thinking…" line has room reserved, so the table never jumps.
- **Test ids** (Playwright relies on these). Unavailable actions carry `aria-disabled`, and Playwright's `click()` waits for an element to be enabled. To attempt one on purpose, press its shortcut key or pass `{ force: true }`.
  - Buttons: `bj-hit`, `bj-stand`, `bj-double`, `bj-split`.
  - Totals: `bj-dealer-total`, `bj-player-total`, and `bj-player-total-2` for the second split hand. Each carries `data-total`, plus `data-soft`, `data-bust` or `data-blackjack` when they apply.
  - Hands and results: `bj-hand-0` / `bj-hand-1` (with `data-active`), `bj-dealer-hand` (`data-hole`), `bj-outcome` (`data-outcome`), `bj-badge-bust`, `bj-badge-blackjack`, `bj-bet` (`data-bet`).

## Seeds

`seeds.ts` lists deals by seed. Each seed is used as `createRng(seed)` → `engine.setup`, exactly as the shell does with `?seed=` (a number and its decimal string hash the same). To find them, simulate seeds 1–20000 with the engine and keep the smallest seed for each situation. `seeds.test.ts` proves every claim.

| Name              | Seed | What happens                                          |
| ----------------- | ---- | ----------------------------------------------------- |
| `practice`        | 56   | Hard 13 against a 6: stand and the dealer busts       |
| `naturalWin`      | 10   | A natural Blackjack, paid 3:2                         |
| `dealerBlackjack` | 3    | The dealer has Blackjack: an immediate loss           |
| `bustOnHit`       | 4    | One hit busts the learner                             |
| `splitWin`        | 864  | Split 7s: both hands win                              |
| `doubleWin`       | 162  | Double on 11: two bets won                            |
| `push`            | 8    | Stand on 20 and tie the dealer                        |
| `doubleLoss`      | 65   | Double a soft 15: two bets lost (an extra debit)      |
| `splitLoss`       | 87   | Split 6s: both hands lose (an extra debit)            |
| `splitPush`       | 492  | Split 7s: one hand wins and one loses, so it's a push |

Playwright examples: `/games/blackjack/play?seed=10` is a natural Blackjack win, and `?seed=3` loses at once to a dealer Blackjack.

## Tests

- `Board.test.tsx`: the Board on its own, with stacked deals from `test-helpers.ts`.
- `seeds.test.ts`: each seed does what it says.
- `src/components/play/settlement.test.ts`: 3,000 random hands through the real engine and the escrow maths. The wallet always ends at `balance + net × stake` and never goes below zero.
- `integration.test.tsx`: the real registry, GameShell and PracticeHand on those seeds, with fake timers. It covers:
  - win → title, loss → roast and tip, and keyboard-only play;
  - wallet settlement for every outcome: 3:2 rounding, doubles and splits won and lost, the split push, a tie, and leaving mid-hand;
  - one full hand under `<StrictMode>`, settled and logged once;
  - the coach intro and hint.

  The recipe: `await flush(Math.round(BOT_DELAY_MS.normal * 0.6))` per forced bot move (`BOT_DELAY_MS.normal` when the bot has a choice), then `flush(RESULT_REVEAL_MS)` before the result overlay opens.
