/**
 * Traditional pip layouts for number cards 2–10 on the 250 × 350 card grid.
 * Each pip is [x, rowFraction] where rowFraction 0 = top row, 1 = bottom row.
 * Pips below the middle are drawn upside-down, like a real deck.
 */
import { type Rank } from '@/games/core/cards';

export const CARD_VIEW_W = 250;
export const CARD_VIEW_H = 350;

const L = 80;
const C = 125;
const R = 170;
const L9 = 78;
const R9 = 172;

export const PIP_TOP = 80;
export const PIP_BOTTOM = 270;

type Pip = readonly [x: number, row: number];

const third = 1 / 3;
const sideFour = (l: number, r: number): Pip[] => [
  [l, 0],
  [l, third],
  [l, 2 * third],
  [l, 1],
  [r, 0],
  [r, third],
  [r, 2 * third],
  [r, 1],
];

export const PIP_LAYOUTS: Partial<Record<Rank, readonly Pip[]>> = {
  '2': [
    [C, 0],
    [C, 1],
  ],
  '3': [
    [C, 0],
    [C, 0.5],
    [C, 1],
  ],
  '4': [
    [L, 0],
    [R, 0],
    [L, 1],
    [R, 1],
  ],
  '5': [
    [L, 0],
    [R, 0],
    [C, 0.5],
    [L, 1],
    [R, 1],
  ],
  '6': [
    [L, 0],
    [R, 0],
    [L, 0.5],
    [R, 0.5],
    [L, 1],
    [R, 1],
  ],
  '7': [
    [L, 0],
    [R, 0],
    [C, 0.25],
    [L, 0.5],
    [R, 0.5],
    [L, 1],
    [R, 1],
  ],
  '8': [
    [L, 0],
    [R, 0],
    [C, 0.25],
    [L, 0.5],
    [R, 0.5],
    [C, 0.75],
    [L, 1],
    [R, 1],
  ],
  '9': [...sideFour(L9, R9), [C, 0.5]],
  T: [...sideFour(L9, R9), [C, 1 / 6], [C, 5 / 6]],
};

/** Pip size (in card units) per rank: the busier cards use slightly smaller pips. */
export function pipSize(rank: Rank): number {
  if (rank === '9' || rank === 'T') return 42;
  if (rank === '7' || rank === '8') return 46;
  return 50;
}

/** y coordinate for a pip row fraction. */
export function pipY(row: number): number {
  return PIP_TOP + row * (PIP_BOTTOM - PIP_TOP);
}

/** SVG transform that draws the 100 × 100 suit path as a pip of `size` centred at (cx, cy). */
export function pipTransform(cx: number, cy: number, size: number, flipped = false): string {
  const move = `translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 100})`;
  return flipped ? `rotate(180 ${cx} ${cy}) ${move}` : move;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const fmt = (n: number) => Math.round(n * 100) / 100;

/** Short art-deco rays in a ring, as one path (used behind the Ace pip). */
export function rayRingPath(cx: number, cy: number, r1: number, r2: number, count: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const deg = (360 / count) * i - 90;
    const half = 360 / count / 5;
    const [ax, ay] = polar(cx, cy, r1, deg - half / 2);
    const [bx, by] = polar(cx, cy, r2, deg - half);
    const [ex, ey] = polar(cx, cy, r2, deg + half);
    const [fx, fy] = polar(cx, cy, r1, deg + half / 2);
    d += `M${fmt(ax)} ${fmt(ay)}L${fmt(bx)} ${fmt(by)}L${fmt(ex)} ${fmt(ey)}L${fmt(fx)} ${fmt(fy)}Z`;
  }
  return d;
}

/** Point where a ray from (cx, cy) at `deg` leaves the rectangle [x0,x1] × [y0,y1]. */
function rayToRect(
  cx: number,
  cy: number,
  deg: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number] {
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const tx = dx > 0 ? (x1 - cx) / dx : dx < 0 ? (x0 - cx) / dx : Infinity;
  const ty = dy > 0 ? (y1 - cy) / dy : dy < 0 ? (y0 - cy) / dy : Infinity;
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}

/**
 * Art-deco sunburst: `count` alternate wedges from the centre to the edge of a
 * rectangle, as one path. Wedges that cross a corner include that corner.
 */
export function sunburstPath(
  cx: number,
  cy: number,
  count: number,
  rect: { x0: number; y0: number; x1: number; y1: number },
): string {
  const { x0, y0, x1, y1 } = rect;
  const step = 360 / count;
  const corners: [number, number, number][] = [
    [x1, y1, (Math.atan2(y1 - cy, x1 - cx) * 180) / Math.PI],
    [x0, y1, (Math.atan2(y1 - cy, x0 - cx) * 180) / Math.PI],
    [x0, y0, (Math.atan2(y0 - cy, x0 - cx) * 180) / Math.PI],
    [x1, y0, (Math.atan2(y0 - cy, x1 - cx) * 180) / Math.PI],
  ];
  const norm = (d: number) => ((d % 360) + 360) % 360;
  let d = '';
  for (let i = 0; i < count; i += 2) {
    const from = i * step - 90;
    const to = from + step;
    const [ax, ay] = rayToRect(cx, cy, from, x0, y0, x1, y1);
    const [bx, by] = rayToRect(cx, cy, to, x0, y0, x1, y1);
    let seg = `M${fmt(cx)} ${fmt(cy)}L${fmt(ax)} ${fmt(ay)}`;
    for (const [kx, ky, kd] of corners) {
      const rel = norm(kd - from);
      if (rel > 0 && rel < step) seg += `L${fmt(kx)} ${fmt(ky)}`;
    }
    d += `${seg}L${fmt(bx)} ${fmt(by)}Z`;
  }
  return d;
}

/** Five-pointed star path. */
export function starPath(cx: number, cy: number, outer: number, inner: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const [x, y] = polar(cx, cy, r, -90 + i * 36);
    d += `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`;
  }
  return `${d}Z`;
}
