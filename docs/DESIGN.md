# Game of Cards — Design system

**Concept: "Midnight show at the card table."** A rich green felt table lit by a warm
spotlight, brass-and-gold trim, a dash of theatre-curtain velvet, and marquee-bulb details
borrowed from a retro single-screen cinema. Typography mixes a soft, characterful serif
(posters, titles) with a friendly geometric sans (UI, body).

Tokens live in `src/app/globals.css` (`@theme`) and are available as Tailwind utilities
(`bg-felt-800`, `text-gold-300`, `font-display`, …).

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| `felt-950` | `#03110b` | Deepest shadows, footer |
| `felt-900` | `#062417` | Page background |
| `felt-800` | `#0a3524` | Panels on background |
| `felt-700` | `#0e4630` | Table surface (`.felt`) |
| `felt-600` / `500` / `400` | `#13593d` / `#1a704d` / `#2b8f66` | Hover, borders, chips |
| `gold-100…700` | `#fff6d9` → `#8a6312` | Accents, focus rings, Jeet, primary buttons (`gold-400` bg + `ink` text) |
| `velvet-300…700` | `#f08a98` → `#741628` | Drama: roasts, destructive actions, "live" badges |
| `ivory` | `#fbf6ea` | Card faces |
| `parchment` | `#f1e7cf` | Light surfaces (quiz options, share card) |
| `cream` | `#f4ecd8` | Body text on felt |
| `mist` | `#bcd0c3` | Secondary text on felt |
| `ink` | `#17161b` | Text on light surfaces |
| `suit-black/red/blue/green` | `#17161b` / `#c4122f` / `#1b5fc1` / `#12793a` | Suit pips. Four-colour deck: ♠ black, ♥ red, ♦ blue, ♣ green |

Contrast (WCAG AA, ≥ 4.5:1 for body text): `cream` on `felt-900` ≈ 14:1, `mist` on
`felt-900` ≈ 10:1, `gold-300` on `felt-900` ≈ 11:1, `ink` on `gold-400` ≈ 10:1,
`mist` on `felt-700` ≈ 6.4:1. Never put `gold-500`+ text on `felt-700` for body copy.

Suits are **never distinguished by colour alone**: each has a distinct silhouette (spade
with stem, heart, rhombus diamond, three-lobe club) and every card has an `aria-label`.

## Typography

| Role | Font | Size (mobile → desktop) | Weight |
| --- | --- | --- | --- |
| Display / poster | Fraunces (variable, self-hosted) | 40 → 72 px, tracking −0.02em | 700–900 |
| H1 | Fraunces | 32 → 48 px | 700 |
| H2 | Fraunces | 24 → 32 px | 700 |
| H3 | Plus Jakarta Sans | 18 → 20 px | 700 |
| Body | Plus Jakarta Sans | 16 px / 1.6 | 400–500 |
| Small / meta | Plus Jakarta Sans | 13–14 px | 500 |
| Numbers (Jeet, scores) | Jakarta, `tabular-nums` | — | 700 |

Poster treatment (win titles): Fraunces 900 italic, uppercase small "presents" line,
`.text-foil` gold gradient, marquee-bulb frame.

## Spacing & shape

- 4 px base grid (Tailwind default scale). Page gutters 16 px mobile, 24 px tablet,
  32 px desktop; max content width 1200 px.
- Radii: 6 px (chips, inputs), 12 px (buttons), 16 px (`.panel`), cards 8% of width.
- Elevation: `shadow-card` (resting card), `shadow-lift` (dragged/hovered), `shadow-glow`
  (highlighted legal move / coach suggestion).
- Card size: width = clamp(52px, 14vw, 96px) in hands; aspect ratio 5:7.

## Components

- **Button**: `primary` (gold-400 bg, ink text), `secondary` (transparent, gold border),
  `ghost`, `danger` (velvet). Min target 44×44 px. Visible 3 px gold focus outline.
- **Panel** (`.panel`): brass-rimmed translucent box for coach, bet panel, forms.
- **Chip**: rounded filter/tag; selected = gold fill.
- **PlayingCard**: original SVG (see `src/components/cards`). Face cards are geometric
  "monogram" portraits (crown/hat/helmet shapes in suit colour) — not copied from any deck.
  Card back: deep velvet with a gold art-deco sunburst and the GoC monogram.
- **Wallet pill**: gold coin + tabular count-up; flashes green/velvet on change.

## Motion

- Durations: micro 120–180 ms (hover, press), standard 250–350 ms (card move, flip),
  dramatic 600–1200 ms (deal sequence, title reveal). Stagger card deals by 60–90 ms.
- Easing: `--ease-glide` for movement, `--ease-snap` for pops (chips, coins).
- Card flip = 3D rotateY 180° with backface hidden. Deal = translate from the deck position
  + slight rotation settle.
- Bot "thinking" = three bouncing gold dots, 700 ms default (setting: relaxed/normal/fast).
- Celebration: confetti + falling cards for 2.5 s, title slides up with a light sweep.
  Roast: a gentle "wobble" of the cards and a deflating trombone sound (if unmuted).
- **Reduced motion**: if the OS requests it (or the user picks "Reduce" in settings) every
  animation becomes an instant state change or a ≤ 150 ms fade; confetti is replaced by a
  static gold burst; the hero shows a static fan.

## Voice

Friendly, simple, a little filmy. Explain every term the first time it appears. Never
blame the learner — roast the *move*, not the person. Numbers are written as digits.
