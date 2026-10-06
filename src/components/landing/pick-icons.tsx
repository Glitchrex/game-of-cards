/**
 * Small original line icons for the "Pick a game for me" answers (32 × 32 grid, drawn in
 * currentColor). Always decorative: the answer's text is the accessible name.
 */
import { type ReactNode } from 'react';
import { type Mood } from '@/lib/content/schema';
import { type PlayersAnswer, type TimeAnswer } from '@/lib/recommend';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={32}
      height={32}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** One little person: head + shoulders, centred on x. */
function Person({ x, y = 0, scale = 1 }: { x: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="0" cy="10" r="4" />
      <path d="M-7 25c0-5 3-8 7-8s7 3 7 8" />
    </g>
  );
}

export const PLAYERS_ICONS: Record<PlayersAnswer, ReactNode> = {
  solo: (
    <Icon>
      <Person x={16} />
      <path d="M24 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" stroke="none" />
    </Icon>
  ),
  two: (
    <Icon>
      <Person x={10.5} />
      <Person x={21.5} />
    </Icon>
  ),
  'small-group': (
    <Icon>
      <Person x={8} y={2} scale={0.8} />
      <Person x={24} y={2} scale={0.8} />
      <Person x={16} y={3} />
    </Icon>
  ),
  'big-group': (
    <Icon>
      <Person x={6} y={4} scale={0.7} />
      <Person x={26} y={4} scale={0.7} />
      <Person x={11} y={1} scale={0.8} />
      <Person x={21} y={1} scale={0.8} />
      <Person x={16} y={5} scale={0.85} />
    </Icon>
  ),
};

export const MOOD_ICONS: Record<Mood, ReactNode> = {
  chill: (
    <Icon>
      {/* a steaming cup of chai */}
      <path d="M7 14h15v5a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7z" />
      <path d="M22 16h2a3 3 0 0 1 0 6h-2.5" />
      <path d="M11 5c-1 1.5 1 2.5 0 4M15.5 4c-1 1.5 1 2.5 0 4" />
    </Icon>
  ),
  brainy: (
    <Icon>
      {/* a light bulb */}
      <path d="M11 21c-2.5-2-4-4.4-4-7.5a9 9 0 0 1 18 0c0 3.1-1.5 5.5-4 7.5v2H11z" />
      <path d="M12 27h8M13 23v-4l3-3 3 3v4" />
    </Icon>
  ),
  social: (
    <Icon>
      {/* two speech bubbles */}
      <path d="M4 7h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-4 3v-3H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path d="M23 12h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1v3l-4-3h-6a2 2 0 0 1-2-2v-1" />
    </Icon>
  ),
  lucky: (
    <Icon>
      {/* a four-leaf clover */}
      <path d="M16 15c-1-4-6-5-7-2s2 5 7 2zM17 15c4-1 5-6 2-7s-5 2-2 7zM16 17c-4 1-5 6-2 7s5-2 2-7zM17 17c1 4 6 5 7 2s-2-5-7-2z" />
      <path d="M17 18c2 4 4 7 7 9" />
    </Icon>
  ),
  competitive: (
    <Icon>
      {/* a trophy */}
      <path d="M10 5h12v6a6 6 0 0 1-12 0z" />
      <path d="M10 7H6a4 4 0 0 0 4 6M22 7h4a4 4 0 0 1-4 6M16 17v5M11 27h10l-1-5h-8z" />
    </Icon>
  ),
};

/** Stopwatch with the hand swept further for longer sessions. */
function Stopwatch({ sweep }: { sweep: 'quick' | 'medium' | 'long' }) {
  const hand = { quick: 'M16 18l3-4', medium: 'M16 18l4 2', long: 'M16 18l-3 4' }[sweep];
  const arc = {
    quick: 'M16 9a9 9 0 0 1 5.6 2',
    medium: 'M16 9a9 9 0 0 1 9 9',
    long: 'M16 9a9 9 0 1 1-8.5 12',
  }[sweep];
  return (
    <Icon>
      <circle cx="16" cy="18" r="10" />
      <path d="M13 4h6M16 4v4M25 9l1.5-1.5" />
      <path d={arc} strokeWidth={3.2} opacity={0.55} />
      <path d={hand} />
    </Icon>
  );
}

export const TIME_ICONS: Record<TimeAnswer, ReactNode> = {
  quick: <Stopwatch sweep="quick" />,
  medium: <Stopwatch sweep="medium" />,
  long: <Stopwatch sweep="long" />,
};
