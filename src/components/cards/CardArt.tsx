/**
 * Pure SVG artwork for card faces and backs (no state, memoised). Everything is
 * drawn on a 250 × 350 grid (5:7). Colours come from theme tokens via Tailwind
 * fill/stroke classes; suit-coloured shapes use `currentColor`.
 *
 * All artwork is original: geometric "monogram portrait" royals, a jester-star
 * joker and an art-deco velvet back with the GoC monogram.
 */
import { memo, type ReactNode } from 'react';
import {
  type CardCode,
  type Rank,
  type Suit,
  RANK_LABELS,
  isJoker,
  rankOf,
  suitOf,
} from '@/games/core/cards';
import { SUIT_PATHS, cardColorClass } from './suits';
import {
  CARD_VIEW_H,
  CARD_VIEW_W,
  PIP_LAYOUTS,
  pipSize,
  pipTransform,
  pipY,
  rayRingPath,
  starPath,
  sunburstPath,
} from './pips';

const VIEW_BOX = `0 0 ${CARD_VIEW_W} ${CARD_VIEW_H}`;
const CX = CARD_VIEW_W / 2;
const CY = CARD_VIEW_H / 2;

const SKIN = '#f2dcc0';
const HAIR = '#4b2f1c';
const INK = '#17161b';

const ACE_RAYS = rayRingPath(CX, CY, 92, 104, 28);
const BACK_RAYS = sunburstPath(CX, CY, 48, { x0: 20, y0: 20, x1: 230, y1: 330 });
const JOKER_STAR = starPath(CX, 196, 64, 27);
const JOKER_CORNER_STAR = starPath(0, 0, 13, 5.5);

function Suit({
  suit,
  cx,
  cy,
  size,
  flipped,
  className,
}: {
  suit: Suit;
  cx: number;
  cy: number;
  size: number;
  flipped?: boolean;
  className?: string;
}) {
  return (
    <path
      d={SUIT_PATHS[suit]}
      fill="currentColor"
      className={className}
      transform={pipTransform(cx, cy, size, flipped)}
    />
  );
}

/** Rank + small suit, stacked. Drawn at the top-left; the caller rotates a copy. */
function CornerIndex({ rank, suit, compact }: { rank: Rank; suit: Suit; compact: boolean }) {
  const label = RANK_LABELS[rank];
  const ten = label.length > 1;
  if (compact) {
    return (
      <g>
        <text
          x={56}
          y={96}
          textAnchor="middle"
          fontSize={ten ? 80 : 96}
          fontWeight={700}
          letterSpacing={ten ? -8 : 0}
          fill="currentColor"
          className="font-display"
        >
          {label}
        </text>
        <Suit suit={suit} cx={56} cy={146} size={62} />
      </g>
    );
  }
  return (
    <g>
      <text
        x={31}
        y={58}
        textAnchor="middle"
        fontSize={ten ? 42 : 50}
        fontWeight={700}
        letterSpacing={ten ? -4 : 0}
        fill="currentColor"
        className="font-display"
      >
        {label}
      </text>
      <Suit suit={suit} cx={31} cy={82} size={30} />
    </g>
  );
}

/* ---------------------------------------------------------------- royals */

/** Robe/shoulders shared by the three royals (upper half of the panel). */
const SHOULDERS = 'M66 175V164C66 151 86 141 108 138H142C164 141 184 151 184 164V175Z';

function KingBust({ suit }: { suit: Suit }) {
  return (
    <g>
      <path d={SHOULDERS} fill="currentColor" />
      <path d="M117 138H133L137 175H113Z" className="fill-gold-400" />
      <path
        d="M93 141C104 151 146 151 157 141L163 151C149 163 101 163 87 151Z"
        className="fill-ivory"
        stroke={INK}
        strokeWidth={0.8}
      />
      <path d="M103 152v5M114 155v5M125 156v5M136 155v5M147 152v5" stroke={INK} strokeWidth={2} />
      <rect x={117} y={124} width={16} height={16} fill={SKIN} />
      <ellipse cx={125} cy={110} rx={17} ry={20} fill={SKIN} stroke={INK} strokeWidth={1} />
      <path d="M114 106q4-3 8 0M128 106q4-3 8 0" stroke={INK} strokeWidth={1.6} fill="none" />
      <path
        d="M108 110C108 128 116 138 125 140C134 138 142 128 142 110C136 121 114 121 108 110Z"
        fill={HAIR}
      />
      <path d="M116 117q9-5 18 0" stroke={SKIN} strokeWidth={1.4} fill="none" />
      <path
        d="M104 94V70L113 81L119 62L125 77L131 62L137 81L146 70V94Z"
        className="fill-gold-400 stroke-gold-700"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <rect x={104} y={88} width={42} height={6} className="fill-gold-600" />
      <circle cx={104} cy={69} r={3} className="fill-gold-200" />
      <circle cx={119} cy={61} r={3} className="fill-gold-200" />
      <circle cx={131} cy={61} r={3} className="fill-gold-200" />
      <circle cx={146} cy={69} r={3} className="fill-gold-200" />
      <circle cx={125} cy={84} r={3.4} fill="currentColor" />
      <path
        d="M171 172L165 110"
        className="stroke-gold-600"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={165} cy={107} r={12} className="fill-ivory stroke-gold-500" strokeWidth={1.5} />
      <Suit suit={suit} cx={165} cy={107} size={15} />
    </g>
  );
}

function QueenBust({ suit }: { suit: Suit }) {
  return (
    <g>
      <path
        d="M101 114C99 88 109 78 125 78C141 78 151 88 149 114L154 142C143 148 107 148 96 142Z"
        fill={HAIR}
      />
      <path d={SHOULDERS} fill="currentColor" />
      <path
        d="M106 138L125 162L144 138"
        className="stroke-gold-400"
        strokeWidth={3.5}
        fill="none"
      />
      <path d="M110 138L125 157L140 138Z" fill={SKIN} />
      <rect x={118} y={124} width={14} height={16} fill={SKIN} />
      <ellipse cx={125} cy={108} rx={16} ry={19} fill={SKIN} stroke={INK} strokeWidth={1} />
      <path d="M115 105q4-3 8 0M127 105q4-3 8 0" stroke={INK} strokeWidth={1.6} fill="none" />
      <path d="M120 117q5 3 10 0" stroke="#b5314a" strokeWidth={1.8} fill="none" />
      <path
        d="M107 93C112 85 138 85 143 93L136 89L131 80L125 70L119 80L114 89Z"
        className="fill-gold-400 stroke-gold-700"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <circle cx={125} cy={81} r={3.2} fill="currentColor" />
      <g className="fill-gold-300">
        <circle cx={111} cy={143} r={2.2} />
        <circle cx={117} cy={148} r={2.2} />
        <circle cx={133} cy={148} r={2.2} />
        <circle cx={139} cy={143} r={2.2} />
      </g>
      <circle cx={125} cy={151} r={3.4} className="fill-gold-300" />
      <path
        d="M86 172C84 156 84 140 82 126"
        className="stroke-gold-600"
        strokeWidth={2.2}
        fill="none"
      />
      <circle cx={82} cy={118} r={12} className="fill-ivory stroke-gold-500" strokeWidth={1.5} />
      <Suit suit={suit} cx={82} cy={118} size={15} />
    </g>
  );
}

function JackBust({ suit }: { suit: Suit }) {
  return (
    <g>
      <path
        d="M105 106C103 93 111 88 125 88C139 88 147 93 145 106L147 122C140 115 110 115 103 122Z"
        fill={HAIR}
      />
      <path d={SHOULDERS} fill="currentColor" />
      <path
        d="M90 145L98 153L106 145L114 153L122 145L130 153L138 145L146 153L154 145L160 151"
        className="stroke-gold-400"
        strokeWidth={3}
        fill="none"
        strokeLinejoin="round"
      />
      <rect x={118} y={124} width={14} height={16} fill={SKIN} />
      <ellipse cx={125} cy={111} rx={16} ry={19} fill={SKIN} stroke={INK} strokeWidth={1} />
      <path d="M115 109q4-3 8 0M127 109q4-3 8 0" stroke={INK} strokeWidth={1.6} fill="none" />
      <path d="M121 121q4 2 8 0" stroke={INK} strokeWidth={1.3} fill="none" />
      <path
        d="M148 93C153 75 165 66 182 62C177 74 168 85 152 96Z"
        className="fill-gold-300 stroke-gold-600"
        strokeWidth={1}
      />
      <path
        d="M151 94C158 82 168 71 179 65"
        className="stroke-gold-600"
        strokeWidth={1.2}
        fill="none"
      />
      <path d="M99 99C97 80 151 73 157 94C146 101 111 103 99 99Z" fill="currentColor" />
      <path
        d="M98 97C114 102 142 101 157 93L158 99C142 107 114 108 98 103Z"
        className="fill-gold-500"
      />
      <circle cx={125} cy={164} r={10} className="fill-ivory stroke-gold-500" strokeWidth={1.5} />
      <Suit suit={suit} cx={125} cy={164} size={13} />
    </g>
  );
}

const ROYALS: Record<'J' | 'Q' | 'K', (p: { suit: Suit }) => ReactNode> = {
  J: JackBust,
  Q: QueenBust,
  K: KingBust,
};

function RoyalPanel({ rank, suit }: { rank: 'J' | 'Q' | 'K'; suit: Suit }) {
  const Bust = ROYALS[rank];
  const half = (
    <g>
      <text
        x={CX}
        y={163}
        textAnchor="middle"
        fontSize={124}
        fontWeight={900}
        className="fill-gold-500 font-display"
        opacity={0.2}
      >
        {rank}
      </text>
      <g transform={`translate(${CX} ${CY}) scale(1.12) translate(${-CX} ${-CY})`}>
        <Bust suit={suit} />
      </g>
    </g>
  );
  return (
    <g>
      <rect
        x={58}
        y={40}
        width={134}
        height={270}
        rx={9}
        className="fill-parchment"
        stroke="currentColor"
        strokeWidth={2.5}
      />
      {half}
      <g transform={`rotate(180 ${CX} ${CY})`}>{half}</g>
      <rect
        x={63.5}
        y={45.5}
        width={123}
        height={259}
        rx={6}
        fill="none"
        className="stroke-gold-500"
        strokeWidth={1.2}
      />
      <path d={`M64 ${CY}H186`} className="stroke-gold-500" strokeWidth={1.4} />
      <path
        d={`M${CX} ${CY - 7}L${CX + 7} ${CY}L${CX} ${CY + 7}L${CX - 7} ${CY}Z`}
        className="fill-gold-400 stroke-gold-700"
        strokeWidth={0.8}
      />
    </g>
  );
}

/* ----------------------------------------------------------------- faces */

function NumberPips({ rank, suit }: { rank: Rank; suit: Suit }) {
  const layout = PIP_LAYOUTS[rank] ?? [];
  const size = pipSize(rank);
  return (
    <g>
      {layout.map(([x, row], i) => (
        <Suit key={i} suit={suit} cx={x} cy={pipY(row)} size={size} flipped={row > 0.5} />
      ))}
    </g>
  );
}

function AcePip({ suit }: { suit: Suit }) {
  const spade = suit === 'S';
  return (
    <g>
      <circle cx={CX} cy={CY} r={84} fill="none" className="stroke-gold-500" strokeWidth={1.4} />
      <circle
        cx={CX}
        cy={CY}
        r={78}
        fill="none"
        className="stroke-gold-400"
        strokeWidth={0.8}
        opacity={0.7}
      />
      <path d={ACE_RAYS} className="fill-gold-400" opacity={0.85} />
      <Suit suit={suit} cx={CX} cy={CY} size={spade ? 128 : 112} />
      {spade && (
        <>
          <path
            d={SUIT_PATHS.S}
            fill="none"
            className="stroke-ivory"
            strokeWidth={2.4}
            transform={pipTransform(CX, CY - 4, 84)}
          />
          <text
            x={CX}
            y={308}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            letterSpacing={3.5}
            className="fill-gold-700 font-sans"
          >
            GAME OF CARDS
          </text>
        </>
      )}
    </g>
  );
}

function JokerArt({ compact }: { compact: boolean }) {
  const corner = (
    <g>
      {compact ? (
        <g transform="translate(52 70) scale(2.6)">
          <path
            d={JOKER_CORNER_STAR}
            className="fill-gold-500"
            stroke="currentColor"
            strokeWidth={1.2}
          />
        </g>
      ) : (
        <g>
          {'JOKER'.split('').map((ch, i) => (
            <text
              key={i}
              x={30}
              y={46 + i * 24}
              textAnchor="middle"
              fontSize={24}
              fontWeight={800}
              fill="currentColor"
              className="font-display"
            >
              {ch}
            </text>
          ))}
          <g transform="translate(30 162)">
            <path
              d={JOKER_CORNER_STAR}
              className="fill-gold-500"
              stroke="currentColor"
              strokeWidth={1.2}
            />
          </g>
        </g>
      )}
    </g>
  );
  return (
    <g>
      {corner}
      {!compact && <g transform={`rotate(180 ${CX} ${CY})`}>{corner}</g>}
      {!compact && (
        <g>
          <path
            d="M88 142C80 116 70 100 52 92C76 88 96 100 104 122C108 96 116 80 125 60C134 80 142 96 146 122C154 100 174 88 198 92C180 100 170 116 162 142Z"
            fill="currentColor"
          />
          <path
            d="M86 140H164L160 152H90Z"
            className="fill-gold-500 stroke-gold-700"
            strokeWidth={1}
          />
          <circle
            cx={52}
            cy={92}
            r={8}
            className="fill-gold-300 stroke-gold-700"
            strokeWidth={1.2}
          />
          <circle
            cx={125}
            cy={59}
            r={8}
            className="fill-gold-300 stroke-gold-700"
            strokeWidth={1.2}
          />
          <circle
            cx={198}
            cy={92}
            r={8}
            className="fill-gold-300 stroke-gold-700"
            strokeWidth={1.2}
          />
          <path
            d={JOKER_STAR}
            className="fill-gold-400 stroke-gold-700"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <circle
            cx={CX}
            cy={200}
            r={18}
            className="fill-ivory stroke-gold-700"
            strokeWidth={1.5}
          />
          <path d="M117 196q3-3 6 0M127 196q3-3 6 0" stroke={INK} strokeWidth={1.6} fill="none" />
          <path
            d="M115 204q10 9 20 0"
            stroke="currentColor"
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
          <text
            x={CX}
            y={296}
            textAnchor="middle"
            fontSize={24}
            fontWeight={800}
            letterSpacing={7}
            fill="currentColor"
            className="font-display"
          >
            JOKER
          </text>
        </g>
      )}
      {compact && (
        <path
          d={starPath(160, 248, 62, 26)}
          className="fill-gold-400"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

export interface CardFaceArtProps {
  code: CardCode;
  fourColor: boolean;
  /** Bigger indices and a single large suit — for tiny (xs) cards. */
  compact?: boolean;
  className?: string;
}

/** The face of a card as a standalone SVG (fills its box; decorative). */
export const CardFaceArt = memo(function CardFaceArt({
  code,
  fourColor,
  compact = false,
  className,
}: CardFaceArtProps) {
  const colour = cardColorClass(code, fourColor);
  let body: ReactNode;
  if (isJoker(code)) {
    body = <JokerArt compact={compact} />;
  } else {
    const rank = rankOf(code);
    const suit = suitOf(code);
    const corner = <CornerIndex rank={rank} suit={suit} compact={compact} />;
    let centre: ReactNode;
    if (compact) {
      centre = <Suit suit={suit} cx={168} cy={256} size={104} />;
    } else if (rank === 'A') {
      centre = <AcePip suit={suit} />;
    } else if (rank === 'J' || rank === 'Q' || rank === 'K') {
      centre = <RoyalPanel rank={rank} suit={suit} />;
    } else {
      centre = <NumberPips rank={rank} suit={suit} />;
    }
    body = (
      <>
        {corner}
        {!compact && <g transform={`rotate(180 ${CX} ${CY})`}>{corner}</g>}
        {centre}
      </>
    );
  }
  return (
    <svg
      viewBox={VIEW_BOX}
      className={`block h-full w-full ${colour} ${className ?? ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x={9}
        y={9}
        width={232}
        height={332}
        rx={13}
        fill="none"
        className="stroke-gold-600"
        strokeWidth={1.4}
        opacity={0.35}
      />
      {body}
    </svg>
  );
});

/** The back artwork's shapes (shared by the inline art and the reusable <symbol>). */
function BackArtShapes() {
  return (
    <>
      <path d={BACK_RAYS} className="fill-gold-300" opacity={0.13} />
      <rect
        x={11}
        y={11}
        width={228}
        height={328}
        rx={14}
        fill="none"
        className="stroke-gold-400"
        strokeWidth={3.5}
      />
      <rect
        x={20}
        y={20}
        width={210}
        height={310}
        rx={8}
        fill="none"
        className="stroke-gold-300"
        strokeWidth={1.2}
        opacity={0.7}
      />
      <g className="stroke-gold-400" fill="none" strokeWidth={1.6} opacity={0.85}>
        <path d="M20 58A38 38 0 0 0 58 20M20 46A26 26 0 0 0 46 20M20 34A14 14 0 0 0 34 20" />
        <path d="M230 58A38 38 0 0 1 192 20M230 46A26 26 0 0 1 204 20M230 34A14 14 0 0 1 216 20" />
        <path d="M20 292A38 38 0 0 1 58 330M20 304A26 26 0 0 1 46 330M20 316A14 14 0 0 1 34 330" />
        <path d="M230 292A38 38 0 0 0 192 330M230 304A26 26 0 0 0 204 330M230 316A14 14 0 0 0 216 330" />
      </g>
      <g className="fill-gold-400">
        <path d="M125 98L133 112L125 126L117 112Z" />
        <path d="M125 224L133 238L125 252L117 238Z" />
        <circle cx={125} cy={78} r={3} />
        <circle cx={125} cy={272} r={3} />
      </g>
      <circle cx={CX} cy={CY} r={44} className="fill-velvet-700 stroke-gold-400" strokeWidth={3} />
      <circle
        cx={CX}
        cy={CY}
        r={37}
        fill="none"
        className="stroke-gold-300"
        strokeWidth={1}
        opacity={0.8}
      />
      <text
        x={CX}
        y={CY + 11}
        textAnchor="middle"
        fontSize={33}
        fontWeight={700}
        fontStyle="italic"
        className="fill-gold-300 font-display"
      >
        GoC
      </text>
    </>
  );
}

/** Card back artwork: velvet (from the container background), gold sunburst, GoC monogram. */
export const CardBackArt = memo(function CardBackArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      className={`block h-full w-full ${className ?? ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <BackArtShapes />
    </svg>
  );
});

/**
 * The back artwork as a `<symbol>` (render once, hidden), for scenes that show many backs
 * at once: each back is then a two-node `<CardBackUse>` instead of a full SVG tree, which
 * keeps the DOM (and hydration) small.
 */
export function CardBackSymbol({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <symbol id={id} viewBox={VIEW_BOX}>
        <BackArtShapes />
      </symbol>
    </svg>
  );
}

/** One card back drawn from a `<CardBackSymbol>` with the same `id`. */
export function CardBackUse({ symbolId }: { symbolId: string }) {
  return (
    <svg viewBox={VIEW_BOX} className="block h-full w-full" aria-hidden="true" focusable="false">
      <use href={`#${symbolId}`} />
    </svg>
  );
}

/** Ivory, paper-textured face background (cheap CSS gradients, no filters). */
export const FACE_BACKGROUND =
  'radial-gradient(140% 100% at 22% 0%, #fffdf7 0%, rgb(251 246 234 / 0) 55%), ' +
  'repeating-linear-gradient(118deg, rgb(120 92 40 / 0.035) 0 1px, transparent 1px 3px), ' +
  'linear-gradient(180deg, var(--color-ivory) 0%, #f5edd9 100%)';

/** Deep velvet back background. */
export const BACK_BACKGROUND =
  'radial-gradient(90% 70% at 50% 50%, var(--color-velvet-600) 0%, var(--color-velvet-700) 55%, #3f0a16 100%)';
