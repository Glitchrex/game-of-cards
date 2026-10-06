import {
  journeyLayouts,
  MAP_WIDTH,
  serpentineLayout,
  zigzagLayout,
  type MapLayout,
} from './layout';

/** Every number in a path string. */
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

/** First and last point of a leg ("M x y … x y"). */
function ends(d: string): { from: [number, number]; to: [number, number] } {
  const n = numbers(d);
  return {
    from: [n[0] ?? NaN, n[1] ?? NaN],
    to: [n[n.length - 2] ?? NaN, n[n.length - 1] ?? NaN],
  };
}

/** Points along a leg ("M a L b" or "M a C c1 c2 b"), for checking where the road goes. */
function sample(d: string): [number, number][] {
  const n = numbers(d);
  if (n.length === 4)
    return [
      [n[0] ?? 0, n[1] ?? 0],
      [n[2] ?? 0, n[3] ?? 0],
    ];
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0] = n;
  const out: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const u = 1 - t;
    const b = (p0: number, p1: number, p2: number, p3: number) =>
      u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    out.push([b(x0, x1, x2, x3), b(y0, y1, y2, y3)]);
  }
  return out;
}

function expectConnected(layout: MapLayout) {
  const points = [layout.start, ...layout.stops, layout.finish];
  expect(layout.legs).toHaveLength(layout.stops.length + 1);
  layout.legs.forEach((leg, i) => {
    expect(leg.startsWith('M ')).toBe(true);
    const { from, to } = ends(leg);
    const a = points[i];
    const b = points[i + 1];
    expect(from[0]).toBeCloseTo(a?.x ?? NaN, 0);
    expect(from[1]).toBeCloseTo(a?.y ?? NaN, 0);
    expect(to[0]).toBeCloseTo(b?.x ?? NaN, 0);
    expect(to[1]).toBeCloseTo(b?.y ?? NaN, 0);
  });
}

describe('journey map layouts', () => {
  const COUNT = 31;
  const all = journeyLayouts(COUNT);

  it.each(Object.entries(all))('%s: one stop per game, all on the map', (_name, layout) => {
    expect(layout.stops).toHaveLength(COUNT);
    for (const p of [layout.start, ...layout.stops, layout.finish]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(MAP_WIDTH);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(layout.height);
    }
    // The road itself (not just the stops) stays on the map, with room for its width.
    for (const leg of layout.legs) {
      for (const [x, y] of sample(leg)) {
        expect(x).toBeGreaterThanOrEqual(10);
        expect(x).toBeLessThanOrEqual(MAP_WIDTH - 10);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(layout.height);
      }
    }
  });

  it.each(Object.entries(all))('%s: the road runs start → every stop → finish', (_n, layout) => {
    expectConnected(layout);
    // Journey order runs down the page: never back up by more than a gentle hill.
    const ys = [layout.start, ...layout.stops, layout.finish].map((p) => p.y);
    ys.slice(1).forEach((y, i) => expect(y).toBeGreaterThan((ys[i] ?? 0) - 40));
  });

  it('serpentine rows alternate direction and turn at the edges', () => {
    const l = serpentineLayout(9, {
      cols: 4,
      rowHeight: 200,
      top: 100,
      bottom: 100,
      marginX: 100,
      bulge: 120,
      wobble: [],
      lead: 80,
    });
    const xs = l.stops.map((p) => Math.round(p.x));
    expect(xs).toEqual([100, 367, 633, 900, 900, 633, 367, 100, 100]);
    expect(l.stops.map((p) => p.y)).toEqual([100, 100, 100, 100, 300, 300, 300, 300, 500]);
    // Finish continues the serpentine.
    expect(Math.round(l.finish.x)).toBe(367);
    expect(l.start).toEqual({ x: 100, y: 20 });
    // The right-hand U-turn (stop 4 → 5) swings out past x = 900.
    expect(Math.max(...numbers(l.legs[4] ?? '').filter((_, i) => i % 2 === 0))).toBe(1020);
    expect(l.height).toBe(600);
  });

  it('zig-zag swings between its x positions, one stop per row', () => {
    const l = zigzagLayout(4, { xs: [250, 750], rowHeight: 120, top: 100, bottom: 80, lead: 60 });
    expect(l.stops).toEqual([
      { x: 250, y: 100 },
      { x: 750, y: 220 },
      { x: 250, y: 340 },
      { x: 750, y: 460 },
    ]);
    expect(l.finish).toEqual({ x: 250, y: 580 });
    expect(l.height).toBe(660);
    expectConnected(l);
  });

  it('copes with an empty catalog', () => {
    const l = zigzagLayout(0, { xs: [500], rowHeight: 100, top: 100, bottom: 100, lead: 50 });
    expect(l.stops).toEqual([]);
    expect(l.legs).toHaveLength(1);
    expect(l.height).toBeGreaterThan(l.finish.y);
  });
});
