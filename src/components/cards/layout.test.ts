import { cardCountText, cardKeys, fanPose, fanSpill, rowLayout } from './layout';

describe('cardKeys', () => {
  it('gives unique keys even for duplicate cards', () => {
    expect(cardKeys(['AS', 'KH', 'AS'])).toEqual(['AS~0', 'KH~0', 'AS~1']);
  });
});

describe('rowLayout', () => {
  it('lets a single card sit without margins', () => {
    const row = rowLayout(1, '56px', '6px');
    expect(row.margin(0)).toBeUndefined();
    expect(row.container.containerType).toBe('inline-size');
  });

  it('fits N cards into the container with a bounded overlap', () => {
    const row = rowLayout(13, '56px', '6px', 0.3);
    expect(row.margin(0)).toBeUndefined();
    expect(row.margin(5)).toBe('max(calc(-0.7 * 56px), min(6px, calc((100cqw - 13 * 56px) / 12)))');
    expect(row.container.width).toBe('min(100%, calc(13 * 56px + 12 * 6px + 2 * 0px))');
  });

  it('reserves room for fanned cards that swing outwards', () => {
    const row = rowLayout(5, '56px', '-20px', 0.3, 0.4);
    expect(row.container.paddingInline).toBe('calc(0.4 * 56px)');
  });
});

describe('fanPose', () => {
  it('is symmetric and flat for one card', () => {
    expect(fanPose(0, 1)).toEqual({ rotate: 0, y: '0%' });
    const left = fanPose(0, 5);
    const right = fanPose(4, 5);
    expect(left.rotate).toBe(-right.rotate);
    expect(left.y).toBe(right.y);
    expect(fanPose(2, 5)).toEqual({ rotate: 0, y: '0%' });
  });

  it('never fans wider than ±22°', () => {
    expect(Math.abs(fanPose(0, 30).rotate)).toBeLessThanOrEqual(22);
    expect(fanSpill(30)).toBeGreaterThan(fanSpill(3));
    expect(fanSpill(1)).toBe(0);
  });
});

describe('cardCountText', () => {
  it('pluralises', () => {
    expect(cardCountText(1)).toBe('1 card');
    expect(cardCountText(7)).toBe('7 cards');
  });
});
