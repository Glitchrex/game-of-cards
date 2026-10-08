/**
 * Poster "key art": a tiny fan of three cards drawn as one lightweight SVG (rank + suit
 * silhouettes only — a few hundred bytes per card, so a row of posters stays cheap to
 * server-render). Decorative; the poster text carries the meaning.
 */
import {
  RANK_LABELS,
  isJoker,
  rankOf,
  suitOf,
  type CardCode,
  type StandardCard,
} from '@/games/core/cards';
import { SUIT_PATHS } from '@/components/cards/suits';

const FALLBACK: readonly StandardCard[] = ['AS', 'KH', 'QD'];
const ANGLES = [-16, 0, 16] as const;

/** Up to three distinct, non-joker cards from the game's lesson scenes (fallback A♠ K♥ Q♦). */
export function posterCards(
  lesson: readonly { scene?: { zones: readonly { cards: readonly string[] }[] } }[],
): StandardCard[] {
  const seen = new Set<string>();
  const out: StandardCard[] = [];
  for (const step of lesson) {
    for (const zone of step.scene?.zones ?? []) {
      for (const code of zone.cards) {
        if (out.length >= 3) return out;
        if (seen.has(code) || isJoker(code)) continue;
        seen.add(code);
        out.push(code as StandardCard);
      }
    }
  }
  for (const code of FALLBACK) {
    if (out.length >= 3) break;
    if (!seen.has(code)) out.push(code);
  }
  return out;
}

function MiniCard({ code, angle }: { code: CardCode; angle: number }) {
  const suit = suitOf(code);
  const red = suit === 'H' || suit === 'D';
  const color = red ? '#c4122f' : '#17161b';
  const label = RANK_LABELS[rankOf(code)];
  return (
    <g transform={`rotate(${angle} 100 205)`}>
      <rect
        x="68"
        y="34"
        width="64"
        height="90"
        rx="6"
        fill="#fbf6ea"
        stroke="#d9cdb0"
        strokeWidth="1"
      />
      <rect
        x="71.5"
        y="37.5"
        width="57"
        height="83"
        rx="4"
        fill="none"
        stroke="#e8dcc0"
        strokeWidth="0.8"
      />
      <g fill={color}>
        <text
          x="75"
          y="52"
          fontSize="14"
          fontWeight="800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {label}
        </text>
        <path d={SUIT_PATHS[suit]} transform="translate(75.5 55) scale(0.1)" />
        <path d={SUIT_PATHS[suit]} transform="translate(85 64) scale(0.3)" />
      </g>
    </g>
  );
}

export function PosterKeyArt({
  cards,
  className,
}: {
  cards: readonly CardCode[];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 150"
      className={className}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <ellipse cx="100" cy="132" rx="70" ry="9" fill="#000" fillOpacity="0.35" />
      {cards.slice(0, 3).map((code, i) => (
        <MiniCard key={code} code={code} angle={ANGLES[i] ?? 0} />
      ))}
    </svg>
  );
}
