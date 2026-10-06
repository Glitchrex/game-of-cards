/**
 * Geometry for the journey map's winding road. Pure and deterministic.
 *
 * Coordinates: `x` is in viewBox units across a fixed 1000-unit width (so 270 = 27 % of
 * the map's width) and `y` is in CSS pixels. The SVG road is drawn with
 * `preserveAspectRatio="none"` and non-scaling strokes, and the HTML stops are placed at
 * `left: x/10 %; top: y px`, so the road always runs through the stops at any width.
 */

export const MAP_WIDTH = 1000;

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapLayout {
  /** One point per stop, in journey order. */
  stops: MapPoint[];
  /** The "Start" sign above the first stop. */
  start: MapPoint;
  /** The trophy after the last stop. */
  finish: MapPoint;
  /** Total map height in px. */
  height: number;
  /** Road legs: start → stop 0, stop 0 → stop 1, …, last stop → finish (stops + 1 legs). */
  legs: string[];
}

const r = (n: number) => Math.round(n * 10) / 10;
const pt = (p: MapPoint) => `${r(p.x)} ${r(p.y)}`;

function straight(a: MapPoint, b: MapPoint): string {
  return `M ${pt(a)} L ${pt(b)}`;
}

function cubic(a: MapPoint, c1: MapPoint, c2: MapPoint, b: MapPoint): string {
  return `M ${pt(a)} C ${pt(c1)} ${pt(c2)} ${pt(b)}`;
}

export interface SerpentineOptions {
  /** Stops per row (≥ 2). */
  cols: number;
  rowHeight: number;
  /** y of the first row. */
  top: number;
  /** Space below the last point. */
  bottom: number;
  /** Horizontal margin (viewBox units) before the first and after the last column. */
  marginX: number;
  /** How far (viewBox units) the U-turn between rows swings out past the row's end. */
  bulge: number;
  /** Per-column vertical offsets (px) that make the road roll like gentle hills. */
  wobble: readonly number[];
  /** Distance (px) from the Start sign down to the first stop. */
  lead: number;
}

/**
 * Desktop/tablet road: rows that alternate direction (left→right, then right→left),
 * joined by smooth U-turns at the edges.
 */
export function serpentineLayout(count: number, o: SerpentineOptions): MapLayout {
  const cols = Math.max(2, Math.floor(o.cols));
  const step = (MAP_WIDTH - 2 * o.marginX) / (cols - 1);
  const colOf = (i: number) => {
    const row = Math.floor(i / cols);
    const c = i % cols;
    return row % 2 === 0 ? c : cols - 1 - c;
  };
  const at = (i: number): MapPoint => {
    const col = colOf(i);
    const row = Math.floor(i / cols);
    return {
      x: o.marginX + col * step,
      y: o.top + row * o.rowHeight + (o.wobble.length ? (o.wobble[col % o.wobble.length] ?? 0) : 0),
    };
  };
  const points = Array.from({ length: Math.max(0, count) + 1 }, (_, i) => at(i));
  const stops = points.slice(0, -1);
  const finish = points[points.length - 1] ?? { x: o.marginX, y: o.top };
  const first = stops[0] ?? finish;
  const start = { x: first.x, y: first.y - o.lead };

  const legs = [straight(start, first)];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as MapPoint;
    const b = points[i + 1] as MapPoint;
    const sameRow = Math.floor(i / cols) === Math.floor((i + 1) / cols);
    if (sameRow) {
      const half = (b.x - a.x) / 2;
      legs.push(cubic(a, { x: a.x + half, y: a.y }, { x: b.x - half, y: b.y }, b));
    } else {
      const side = colOf(i) === cols - 1 ? 1 : -1;
      legs.push(
        cubic(a, { x: a.x + side * o.bulge, y: a.y }, { x: b.x + side * o.bulge, y: b.y }, b),
      );
    }
  }
  const maxY = Math.max(...points.map((p) => p.y));
  return { stops, start, finish, height: Math.ceil(maxY + o.bottom), legs };
}

export interface ZigzagOptions {
  /** x positions (viewBox units) the stops cycle through. */
  xs: readonly number[];
  rowHeight: number;
  top: number;
  bottom: number;
  lead: number;
}

/**
 * Phone road: one stop per row, swinging left and right. Each leg leaves a stop
 * sideways and drops into the next one from above, so it never crosses a label
 * (labels sit under their stop).
 */
export function zigzagLayout(count: number, o: ZigzagOptions): MapLayout {
  const xs = o.xs.length ? o.xs : [MAP_WIDTH / 2];
  const at = (i: number): MapPoint => ({
    x: xs[i % xs.length] ?? MAP_WIDTH / 2,
    y: o.top + i * o.rowHeight,
  });
  const points = Array.from({ length: Math.max(0, count) + 1 }, (_, i) => at(i));
  const stops = points.slice(0, -1);
  const finish = points[points.length - 1] ?? at(0);
  const first = stops[0] ?? finish;
  const start = { x: first.x, y: first.y - o.lead };

  const legs = [straight(start, first)];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as MapPoint;
    const b = points[i + 1] as MapPoint;
    if (a.x === b.x) {
      legs.push(straight(a, b));
    } else {
      const drop = b.y - a.y;
      legs.push(cubic(a, { x: b.x, y: a.y }, { x: b.x, y: a.y + drop * 0.3 }, b));
    }
  }
  const maxY = Math.max(...points.map((p) => p.y));
  return { stops, start, finish, height: Math.ceil(maxY + o.bottom), legs };
}

/** The three responsive layouts used by the map (phone, tablet, desktop). */
export function journeyLayouts(count: number): {
  phone: MapLayout;
  tablet: MapLayout;
  desktop: MapLayout;
} {
  return {
    phone: zigzagLayout(count, {
      xs: [270, 730],
      rowHeight: 132,
      top: 116,
      bottom: 116,
      lead: 76,
    }),
    tablet: serpentineLayout(count, {
      cols: 4,
      rowHeight: 200,
      top: 124,
      bottom: 132,
      marginX: 125,
      bulge: 135,
      wobble: [0, 18, -8, 10],
      lead: 82,
    }),
    desktop: serpentineLayout(count, {
      cols: 5,
      rowHeight: 204,
      top: 124,
      bottom: 132,
      marginX: 115,
      bulge: 130,
      wobble: [0, 20, -10, 16, -4],
      lead: 82,
    }),
  };
}
