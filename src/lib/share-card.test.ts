// @vitest-environment jsdom
import {
  DEFAULT_SHARE_CARD_FONTS,
  SHARE_CARD_SIZE,
  createShareImage,
  drawShareCard,
  resolveShareCardFonts,
  shareOrDownload,
  type ShareCardData,
} from './share-card';

interface Call {
  method: string;
  args: unknown[];
  font: string;
  fill: unknown;
}

/**
 * A recording stand-in for CanvasRenderingContext2D: every method call is logged together
 * with the font active at that moment; property writes are stored; measureText assumes
 * every glyph is half the font size wide.
 */
function createMockContext() {
  const calls: Call[] = [];
  const props: Record<string, unknown> = { font: '10px sans-serif' };
  const fontSize = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(props.font))?.[1] ?? 10);
  const gradient = () => ({ addColorStop: () => undefined });
  const impl: Record<string, (...args: never[]) => unknown> = {
    measureText: (text: string) => ({ width: text.length * fontSize() * 0.5 }),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
  };
  const ctx = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        if (prop in props) return props[prop];
        return (...args: unknown[]) => {
          calls.push({ method: prop, args, font: String(props.font), fill: props.fillStyle });
          const fn = impl[prop];
          return fn ? fn(...(args as never[])) : undefined;
        };
      },
      set(_target, prop, value) {
        props[String(prop)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  const texts = () =>
    calls
      .filter((c) => c.method === 'fillText')
      .map((c) => ({ text: String(c.args[0]), font: c.font, fill: c.fill, maxWidth: c.args[3] }));
  return { ctx, calls, texts };
}

const fontSize = (font: string) => Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]);

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const data: ShareCardData = {
  title: 'Don of the Deck',
  film: 'Don (1978)',
  blurb: "Three wins in a row. Catching you isn't just mushkil — it's naamumkin.",
  gameName: 'Teen Patti',
  jeet: 1250,
  dateLabel: '5 Oct 2026',
  siteUrl: 'https://gameofcards.example/',
};

describe('drawShareCard', () => {
  it('is a 1200×630 poster', () => {
    expect(SHARE_CARD_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it('writes the title, film, game, Jeet, date, site and brand lines', () => {
    const { ctx, texts } = createMockContext();
    drawShareCard(ctx, data);
    const all = texts().map((t) => t.text);
    expect(all).toContain('Don of the Deck');
    expect(all.some((t) => t.includes('Game of Cards'))).toBe(true);
    expect(all).toContain('Inspired by Don (1978)');
    const ribbon = all.find((t) => t.includes('Teen Patti'));
    expect(ribbon).toBe('Won at Teen Patti · +1,250 Jeet');
    expect(all).toContain('5 Oct 2026');
    expect(all).toContain('gameofcards.example');
    expect(all).toContain('Pretend money. Real bragging rights.');
    expect(all.join(' ')).toContain('Three wins in a row.');
  });

  it('sets the title in the Fraunces display face, big, with a gold gradient fill', () => {
    const { ctx, texts } = createMockContext();
    drawShareCard(ctx, data);
    const title = texts().find((t) => t.text === 'Don of the Deck');
    expect(title?.font).toMatch(/^italic 900 \d+px 'Fraunces', Georgia, serif$/);
    const size = Number(/(\d+)px/.exec(title?.font ?? '')?.[1]);
    expect(size).toBeGreaterThanOrEqual(72);
  });

  it('shrinks and wraps a long title so every line fits the column', () => {
    const { ctx, calls } = createMockContext();
    const longTitle =
      'The Extraordinarily Magnificent Card Table Champion of the Entire Known Universe';
    drawShareCard(ctx, { ...data, title: longTitle });
    const titleCalls = calls.filter((c) => c.method === 'fillText' && /^italic 900/.test(c.font));
    expect(titleCalls.length).toBeGreaterThan(1);
    expect(titleCalls.length).toBeLessThanOrEqual(3);
    const size = Number(/(\d+)px/.exec(titleCalls[0]?.font ?? '')?.[1]);
    expect(size).toBeLessThan(88);
    expect(size).toBeGreaterThanOrEqual(40);
    for (const c of titleCalls) {
      expect(String(c.args[0]).length * size * 0.5).toBeLessThanOrEqual(680);
      expect(c.args[3]).toBe(680); // maxWidth safety net
    }
    expect(titleCalls.map((c) => c.args[0]).join(' ')).toBe(longTitle);
  });

  it('balances wrapped title lines instead of leaving a lonely last word', () => {
    const { ctx, texts } = createMockContext();
    drawShareCard(ctx, { ...data, title: 'Baazigar of the Table' });
    const lines = texts()
      .filter((t) => /^italic 900/.test(t.font))
      .map((t) => t.text);
    expect(lines).toEqual(['Baazigar of', 'the Table']); // greedy would give "Baazigar of the" / "Table"
  });

  it('shrinks the ribbon type instead of squeezing a long game name', () => {
    const { ctx, texts } = createMockContext();
    drawShareCard(ctx, { ...data, gameName: 'Texas Hold’em Poker', jeet: 125000 });
    const ribbon = texts().find((t) => t.text.startsWith('Won at'));
    expect(ribbon?.text).toBe('Won at Texas Hold’em Poker · +125,000 Jeet');
    const size = fontSize(ribbon?.font ?? '');
    expect(size).toBeLessThan(30);
    expect(size).toBeGreaterThanOrEqual(22);
    // At the chosen size the text fits inside its maxWidth, so nothing gets squeezed.
    expect((ribbon?.text.length ?? 0) * size * 0.5).toBeLessThanOrEqual(Number(ribbon?.maxWidth));

    const short = createMockContext();
    drawShareCard(short.ctx, { ...data, gameName: 'War', jeet: 20 });
    const shortRibbon = short.texts().find((t) => t.text.startsWith('Won at'));
    expect(fontSize(shortRibbon?.font ?? '')).toBe(30);
  });

  it('keeps the small text readable: ≥ 4.5:1 even against the brightest felt', () => {
    const { ctx, texts } = createMockContext();
    drawShareCard(ctx, data);
    const brightestFelt = '#1a704d'; // felt-500, the centre of the felt gradient
    const lines = texts().filter(
      (t) =>
        t.text === 'Game of Cards presents' ||
        t.text.startsWith('Inspired by') ||
        data.blurb?.includes(t.text.replace(/…$/, '')),
    );
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      expect(typeof line.fill, line.text).toBe('string');
      expect(contrast(String(line.fill), brightestFelt), line.text).toBeGreaterThanOrEqual(4.5);
    }
    const ribbon = texts().find((t) => t.text.startsWith('Won at'));
    expect(contrast(String(ribbon?.fill), '#c22f47')).toBeGreaterThanOrEqual(4.5); // velvet-500
  });

  it('ellipsizes a title that cannot fit even at the smallest size', () => {
    const { ctx, calls } = createMockContext();
    const huge = Array.from({ length: 40 }, (_, i) => `Word${i}`).join(' ');
    drawShareCard(ctx, { ...data, title: huge });
    const titleCalls = calls.filter((c) => c.method === 'fillText' && /^italic 900/.test(c.font));
    expect(titleCalls).toHaveLength(3);
    expect(String(titleCalls[2]?.args[0]).endsWith('…')).toBe(true);
  });

  it('draws the marquee bulbs, the felt gradients and a fanned trio of cards', () => {
    const { ctx, calls } = createMockContext();
    drawShareCard(ctx, data);
    const arcs = calls.filter((c) => c.method === 'arc').length;
    expect(arcs).toBeGreaterThanOrEqual(100); // ~100 bulbs × (glow + core)
    expect(calls.some((c) => c.method === 'createRadialGradient')).toBe(true);
    const rotations = calls.filter((c) => c.method === 'rotate').map((c) => Number(c.args[0]));
    expect(rotations.filter((r) => r !== 0 && Math.abs(r) < 0.5)).toHaveLength(2); // ±16°
    const ranks = calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);
    for (const rank of ['A', 'K', 'Q']) expect(ranks.filter((r) => r === rank)).toHaveLength(2);
  });

  it('balances save/restore and never passes non-finite numbers', () => {
    const { ctx, calls } = createMockContext();
    drawShareCard(ctx, { ...data, jeet: Number.NaN });
    const saves = calls.filter((c) => c.method === 'save').length;
    const restores = calls.filter((c) => c.method === 'restore').length;
    expect(saves).toBeGreaterThan(0);
    expect(restores).toBe(saves);
    for (const c of calls) {
      for (const arg of c.args) {
        if (typeof arg === 'number') expect(Number.isFinite(arg), c.method).toBe(true);
      }
    }
  });

  it('handles optional fields, a blank title and non-positive Jeet', () => {
    const { ctx, texts } = createMockContext();
    drawShareCard(ctx, {
      title: '   ',
      gameName: 'War',
      jeet: 0,
      dateLabel: 'Today',
      siteUrl: 'http://localhost:3000',
    });
    const all = texts().map((t) => t.text);
    const titleLines = texts().filter((t) => /^italic 900/.test(t.font));
    expect(titleLines.map((t) => t.text).join(' ')).toBe('Game of Cards Champion');
    expect(all).toContain('Played War · 0 Jeet');
    expect(all).toContain('localhost:3000');
    expect(all.some((t) => t.startsWith('Inspired by'))).toBe(false);

    const noGame = createMockContext();
    drawShareCard(noGame.ctx, { ...data, gameName: '  ', jeet: -40 });
    expect(noGame.texts().map((t) => t.text)).toContain('−40 Jeet');
  });

  it('uses custom font stacks when given', () => {
    const { ctx, texts } = createMockContext();
    drawShareCard(ctx, data, {
      display: '"__fraunces_x", serif',
      sans: '"__jakarta_x", sans-serif',
    });
    const title = texts().find((t) => t.text === 'Don of the Deck');
    expect(title?.font).toContain('"__fraunces_x", serif');
    const ribbon = texts().find((t) => t.text.startsWith('Won at'));
    expect(ribbon?.font).toContain('"__jakarta_x", sans-serif');
  });
});

describe('resolveShareCardFonts', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--font-fraunces');
    document.documentElement.style.removeProperty('--font-jakarta');
  });

  it('falls back to the default stacks without CSS variables', () => {
    expect(resolveShareCardFonts()).toEqual(DEFAULT_SHARE_CARD_FONTS);
  });

  it('prepends the next/font family names from the CSS variables', () => {
    document.documentElement.style.setProperty('--font-fraunces', "'__fraunces_abc'");
    document.documentElement.style.setProperty('--font-jakarta', "'__jakarta_abc'");
    const fonts = resolveShareCardFonts();
    expect(fonts.display).toBe(`'__fraunces_abc', ${DEFAULT_SHARE_CARD_FONTS.display}`);
    expect(fonts.sans).toBe(`'__jakarta_abc', ${DEFAULT_SHARE_CARD_FONTS.sans}`);
  });
});

describe('createShareImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws onto a 1200×630 canvas and resolves with a PNG blob', async () => {
    const { ctx, texts } = createMockContext();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback: BlobCallback, type?: string) => {
        callback(new Blob(['png-bytes'], { type: type ?? 'image/png' }));
      });

    const blob = await createShareImage(data);

    expect(blob.type).toBe('image/png');
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(getContext).toHaveBeenCalledWith('2d');
    const canvas = getContext.mock.contexts[0] as HTMLCanvasElement | undefined;
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas?.width).toBe(1200);
    expect(canvas?.height).toBe(630);
    expect(texts().some((t) => t.text === 'Don of the Deck')).toBe(true);
  });

  it('rejects when the browser has no 2D canvas', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(createShareImage(data)).rejects.toThrow(/2D canvas/);
  });

  it('rejects when the canvas cannot produce a blob', async () => {
    const { ctx } = createMockContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) =>
      callback(null),
    );
    await expect(createShareImage(data)).rejects.toThrow(/share image/);
  });
});

describe('shareOrDownload', () => {
  const blob = new Blob(['png-bytes'], { type: 'image/png' });
  let clicked: HTMLAnchorElement[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock-url'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  function mockShare(share: (data: ShareData) => Promise<void>, canShare = true) {
    const shareFn = vi.fn(share);
    Object.defineProperty(navigator, 'share', { configurable: true, value: shareFn });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn(() => canShare),
    });
    return shareFn;
  }

  it('uses the native share sheet with the PNG file when files can be shared', async () => {
    const share = mockShare(() => Promise.resolve());
    await expect(shareOrDownload(blob, 'baazigar.png', 'I won!')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0]?.[0];
    expect(payload?.text).toBe('I won!');
    const file = payload?.files?.[0];
    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe('baazigar.png');
    expect(file?.type).toBe('image/png');
    expect(clicked).toHaveLength(0);
  });

  it('downloads via an object URL when sharing files is not supported', async () => {
    await expect(shareOrDownload(blob, 'baazigar.png', 'I won!')).resolves.toBe('downloaded');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe('baazigar.png');
    expect(clicked[0]?.getAttribute('href')).toBe('blob:mock-url');
    expect(document.body.contains(clicked[0] ?? null)).toBe(false);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('downloads when the browser says it cannot share these files', async () => {
    const share = mockShare(() => Promise.resolve(), false);
    await expect(shareOrDownload(blob, 'card.png', 'text')).resolves.toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
  });

  it('falls back to a download when sharing fails for another reason', async () => {
    mockShare(() => Promise.reject(new DOMException('Denied', 'NotAllowedError')));
    await expect(shareOrDownload(blob, 'card.png', 'text')).resolves.toBe('downloaded');
    expect(clicked).toHaveLength(1);
  });

  it('rejects with AbortError (and does not download) when the learner cancels', async () => {
    mockShare(() => Promise.reject(new DOMException('Cancelled', 'AbortError')));
    await expect(shareOrDownload(blob, 'card.png', 'text')).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(clicked).toHaveLength(0);
  });
});
