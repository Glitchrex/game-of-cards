/**
 * Share cards: a 1200×630 cinematic "movie poster" for a win title, drawn on a canvas
 * (green felt, gold double frame with marquee bulbs, gold-foil serif title, a fanned trio
 * of cards) and exported as a PNG for the Web Share API or a plain download.
 *
 * `drawShareCard` is pure drawing on any 2D context (unit-tested with a mock context);
 * `createShareImage` and `shareOrDownload` are browser-only helpers.
 */

export interface ShareCardData {
  /** The win title, e.g. "Baazigar of the Table". */
  title: string;
  /** Inspiration, e.g. "Baazigar (1993)". */
  film?: string;
  /** Optional one-line reason ("You were losing, then you weren't…"). */
  blurb?: string;
  gameName: string;
  /** Jeet won in that game. */
  jeet: number;
  /** Pre-formatted date, e.g. "5 Oct 2026". */
  dateLabel: string;
  siteUrl: string;
}

export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;

/** CSS font-family lists used on the card. */
export interface ShareCardFonts {
  display: string;
  sans: string;
}

export const DEFAULT_SHARE_CARD_FONTS: ShareCardFonts = {
  display: "'Fraunces', Georgia, serif",
  sans: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const W = SHARE_CARD_SIZE.width;
const H = SHARE_CARD_SIZE.height;

/** Design tokens (docs/DESIGN.md). */
const C = {
  felt950: '#03110b',
  felt900: '#062417',
  felt700: '#0e4630',
  felt500: '#1a704d',
  gold100: '#fff6d9',
  gold200: '#fbe8a6',
  gold300: '#f5d77a',
  gold400: '#ecc153',
  gold500: '#d6a42c',
  gold600: '#b4841a',
  gold700: '#8a6312',
  velvet500: '#c22f47',
  velvet600: '#9e2036',
  velvet700: '#741628',
  ivory: '#fbf6ea',
  parchment: '#f1e7cf',
  cream: '#f4ecd8',
  mist: '#bcd0c3',
  ink: '#17161b',
  suitRed: '#c4122f',
} as const;

const FRAME_OUTER = 16;
const FRAME_INNER = 44;
const BULB_INSET = 30;
const BULB_SPACING = 34;

/** Text column (left side; the card fan sits on the right). */
const COL_X = 440;
const COL_WIDTH = 680;

const TITLE_TOP = 116;
const TITLE_HEIGHT = 200;
const TITLE_MAX_SIZE = 88;
const TITLE_MIN_SIZE = 40;
const TITLE_MAX_LINES = 3;
const TITLE_LINE_HEIGHT = 1.06;

/** Result ribbon: text shrinks from the max to the min size before it would be squeezed. */
const RIBBON_MAX_WIDTH = COL_WIDTH - 20;
const RIBBON_PADDING = 72;
const RIBBON_FONT_MAX = 30;
const RIBBON_FONT_MIN = 22;

type Ctx = CanvasRenderingContext2D;
type SuitCode = 'S' | 'H' | 'D' | 'C';

// ── Geometry helpers ───────────────────────────────────────────────────────────

/** Adds a rounded-rectangle sub-path (no beginPath, so callers can combine paths). */
function addRoundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function goldGradient(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, C.gold700);
  g.addColorStop(0.22, C.gold300);
  g.addColorStop(0.5, C.gold600);
  g.addColorStop(0.78, C.gold200);
  g.addColorStop(1, C.gold700);
  return g;
}

// ── Text helpers ───────────────────────────────────────────────────────────────

function wrapWords(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Trims `text` until `text…` fits in `maxWidth`. */
function ellipsize(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut.trimEnd()}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/**
 * Like wrapWords, but evens out line lengths (no lonely last word): finds the narrowest
 * width that still needs no more lines than the greedy wrap at `maxWidth`.
 */
function wrapBalanced(ctx: Ctx, text: string, maxWidth: number): string[] {
  const greedy = wrapWords(ctx, text, maxWidth);
  if (greedy.length <= 1) return greedy;
  let lo = 0;
  let hi = maxWidth;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrapWords(ctx, text, mid).length <= greedy.length) hi = mid;
    else lo = mid;
  }
  return wrapWords(ctx, text, hi);
}

/** Wraps (balanced) into at most `maxLines`, ellipsizing the last line if text remains. */
function clampLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const lines = wrapWords(ctx, text, maxWidth);
  if (lines.length <= maxLines) return wrapBalanced(ctx, text, maxWidth);
  const kept = lines.slice(0, maxLines);
  const rest = lines.slice(maxLines - 1).join(' ');
  kept[maxLines - 1] = ellipsize(ctx, rest, maxWidth);
  return kept;
}

function titleFont(size: number, fonts: ShareCardFonts): string {
  return `italic 900 ${size}px ${fonts.display}`;
}

/** Largest font size (TITLE_MAX_SIZE → TITLE_MIN_SIZE) at which the title fits the block. */
function fitTitle(
  ctx: Ctx,
  text: string,
  fonts: ShareCardFonts,
): { size: number; lines: string[] } {
  for (let size = TITLE_MAX_SIZE; size >= TITLE_MIN_SIZE; size -= 4) {
    ctx.font = titleFont(size, fonts);
    const lines = wrapWords(ctx, text, COL_WIDTH);
    const fitsWidth = lines.every((line) => ctx.measureText(line).width <= COL_WIDTH);
    const fitsHeight = lines.length * size * TITLE_LINE_HEIGHT <= TITLE_HEIGHT;
    if (lines.length <= TITLE_MAX_LINES && fitsWidth && fitsHeight) {
      return { size, lines: wrapBalanced(ctx, text, COL_WIDTH) };
    }
  }
  ctx.font = titleFont(TITLE_MIN_SIZE, fonts);
  return { size: TITLE_MIN_SIZE, lines: clampLines(ctx, text, COL_WIDTH, TITLE_MAX_LINES) };
}

function formatJeet(jeet: number): string {
  const n = Number.isFinite(jeet) ? Math.round(jeet) : 0;
  // Same digits as everywhere else on the site (formatJeetDelta in components/ui/Jeet).
  const abs = Math.abs(n).toLocaleString('en-US');
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/\/+$/, '');
}

// ── Scene pieces ───────────────────────────────────────────────────────────────

function drawFelt(ctx: Ctx): void {
  const base = ctx.createRadialGradient(W * 0.42, H * 0.4, 40, W * 0.5, H * 0.5, W * 0.78);
  base.addColorStop(0, C.felt500);
  base.addColorStop(0.45, C.felt700);
  base.addColorStop(1, C.felt950);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Fine diagonal weave so the felt doesn't look like flat plastic.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = C.gold100;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -H; x < W; x += 7) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
  }
  ctx.stroke();
  ctx.restore();

  // Warm spotlight from above.
  const spot = ctx.createRadialGradient(W * 0.4, -60, 0, W * 0.4, -60, 560);
  spot.addColorStop(0, 'rgba(255, 246, 217, 0.2)');
  spot.addColorStop(1, 'rgba(255, 246, 217, 0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  // Vignette.
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, W * 0.72);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

/**
 * A soft dark pool behind the text column. The felt is brightest right where the text
 * sits, so without this the small blurb text drops below a 4.5:1 contrast ratio.
 */
function drawTextScrim(ctx: Ctx): void {
  ctx.save();
  ctx.translate(COL_X, 300);
  ctx.scale(1, 0.62);
  const scrim = ctx.createRadialGradient(0, 0, 0, 0, 0, 470);
  scrim.addColorStop(0, 'rgba(3, 17, 11, 0.42)');
  scrim.addColorStop(0.6, 'rgba(3, 17, 11, 0.3)');
  scrim.addColorStop(1, 'rgba(3, 17, 11, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(-470, -470, 940, 940);
  ctx.restore();
}

function drawFrame(ctx: Ctx): void {
  const gold = goldGradient(ctx, 0, 0, W, H);

  // Dark marquee band between the two frames, so the bulbs pop.
  ctx.save();
  ctx.beginPath();
  addRoundedRect(ctx, FRAME_OUTER, FRAME_OUTER, W - 2 * FRAME_OUTER, H - 2 * FRAME_OUTER, 22);
  addRoundedRect(ctx, FRAME_INNER, FRAME_INNER, W - 2 * FRAME_INNER, H - 2 * FRAME_INNER, 12);
  ctx.fillStyle = 'rgba(3, 17, 11, 0.6)';
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 7;
  ctx.beginPath();
  addRoundedRect(ctx, FRAME_OUTER, FRAME_OUTER, W - 2 * FRAME_OUTER, H - 2 * FRAME_OUTER, 22);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  addRoundedRect(ctx, FRAME_INNER, FRAME_INNER, W - 2 * FRAME_INNER, H - 2 * FRAME_INNER, 12);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  addRoundedRect(
    ctx,
    FRAME_INNER + 7,
    FRAME_INNER + 7,
    W - 2 * (FRAME_INNER + 7),
    H - 2 * (FRAME_INNER + 7),
    8,
  );
  ctx.stroke();
  ctx.restore();
}

/** Marquee bulbs evenly spaced around the band, alternating bright/dim like a chase. */
function drawBulbs(ctx: Ctx): void {
  const i = BULB_INSET;
  const spanX = W - 2 * i;
  const spanY = H - 2 * i;
  const nx = Math.max(1, Math.round(spanX / BULB_SPACING));
  const ny = Math.max(1, Math.round(spanY / BULB_SPACING));
  const points: [number, number][] = [];
  for (let k = 0; k < nx; k++) points.push([i + (k * spanX) / nx, i]);
  for (let k = 0; k < ny; k++) points.push([W - i, i + (k * spanY) / ny]);
  for (let k = 0; k < nx; k++) points.push([W - i - (k * spanX) / nx, H - i]);
  for (let k = 0; k < ny; k++) points.push([i, H - i - (k * spanY) / ny]);

  ctx.save();
  points.forEach(([x, y], index) => {
    const bright = index % 2 === 0;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
    glow.addColorStop(0, bright ? 'rgba(255, 246, 217, 0.75)' : 'rgba(245, 215, 122, 0.35)');
    glow.addColorStop(1, 'rgba(245, 215, 122, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bright ? C.gold100 : C.gold400;
    ctx.beginPath();
    ctx.arc(x, y, bright ? 3.8 : 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/** Suit silhouette centred on (0, 0) in a unit box (scaled by the caller). */
function suitPath(ctx: Ctx, suit: SuitCode): void {
  ctx.beginPath();
  switch (suit) {
    case 'H':
      ctx.moveTo(0, 0.45);
      ctx.bezierCurveTo(-0.15, 0.3, -0.5, 0.1, -0.5, -0.15);
      ctx.bezierCurveTo(-0.5, -0.4, -0.2, -0.5, 0, -0.25);
      ctx.bezierCurveTo(0.2, -0.5, 0.5, -0.4, 0.5, -0.15);
      ctx.bezierCurveTo(0.5, 0.1, 0.15, 0.3, 0, 0.45);
      ctx.closePath();
      break;
    case 'S':
      ctx.moveTo(0, -0.5);
      ctx.bezierCurveTo(-0.15, -0.3, -0.5, -0.1, -0.5, 0.12);
      ctx.bezierCurveTo(-0.5, 0.35, -0.2, 0.42, 0, 0.2);
      ctx.bezierCurveTo(0.2, 0.42, 0.5, 0.35, 0.5, 0.12);
      ctx.bezierCurveTo(0.5, -0.1, 0.15, -0.3, 0, -0.5);
      ctx.closePath();
      ctx.moveTo(0, 0.12);
      ctx.lineTo(-0.17, 0.5);
      ctx.lineTo(0.17, 0.5);
      ctx.closePath();
      break;
    case 'D':
      ctx.moveTo(0, -0.5);
      ctx.lineTo(0.36, 0);
      ctx.lineTo(0, 0.5);
      ctx.lineTo(-0.36, 0);
      ctx.closePath();
      break;
    case 'C':
      ctx.moveTo(0.2, -0.24);
      ctx.arc(0, -0.24, 0.2, 0, Math.PI * 2);
      ctx.moveTo(-0.02, 0.06);
      ctx.arc(-0.22, 0.06, 0.2, 0, Math.PI * 2);
      ctx.moveTo(0.42, 0.06);
      ctx.arc(0.22, 0.06, 0.2, 0, Math.PI * 2);
      ctx.moveTo(0, 0.05);
      ctx.lineTo(-0.15, 0.5);
      ctx.lineTo(0.15, 0.5);
      ctx.closePath();
      break;
  }
}

function drawSuit(ctx: Ctx, suit: SuitCode, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  suitPath(ctx, suit);
  ctx.fillStyle = suit === 'H' || suit === 'D' ? C.suitRed : C.ink;
  ctx.fill();
  ctx.restore();
}

function drawCrown(ctx: Ctx, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(-0.5, 0.3);
  ctx.lineTo(-0.5, -0.25);
  ctx.lineTo(-0.25, 0.05);
  ctx.lineTo(0, -0.35);
  ctx.lineTo(0.25, 0.05);
  ctx.lineTo(0.5, -0.25);
  ctx.lineTo(0.5, 0.3);
  ctx.closePath();
  ctx.fillStyle = C.gold500;
  ctx.fill();
  ctx.restore();
}

interface FanCard {
  rank: 'A' | 'K' | 'Q';
  suit: SuitCode;
  angle: number;
}

const CARD_W = 140;
const CARD_H = 196;
const FAN_PIVOT_X = 965;
const FAN_PIVOT_Y = 690;
const FAN_RADIUS = 330;

function drawCard(ctx: Ctx, card: FanCard, hero: boolean, fonts: ShareCardFonts): void {
  ctx.save();
  ctx.translate(FAN_PIVOT_X, FAN_PIVOT_Y);
  ctx.rotate(card.angle);
  ctx.translate(0, -FAN_RADIUS);
  const x = -CARD_W / 2;
  const y = -CARD_H / 2;

  // Body with a soft drop shadow (gold glow for the hero card).
  ctx.save();
  ctx.shadowColor = hero ? 'rgba(245, 215, 122, 0.55)' : 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = hero ? 28 : 18;
  ctx.shadowOffsetY = hero ? 0 : 8;
  ctx.beginPath();
  addRoundedRect(ctx, x, y, CARD_W, CARD_H, 13);
  ctx.fillStyle = C.ivory;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  addRoundedRect(ctx, x, y, CARD_W, CARD_H, 13);
  ctx.strokeStyle = 'rgba(138, 99, 18, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  addRoundedRect(ctx, x + 9, y + 9, CARD_W - 18, CARD_H - 18, 8);
  ctx.strokeStyle = card.rank === 'A' ? 'rgba(23, 22, 27, 0.12)' : C.gold400;
  ctx.lineWidth = card.rank === 'A' ? 1 : 2;
  ctx.stroke();
  ctx.restore();

  const color = card.suit === 'H' || card.suit === 'D' ? C.suitRed : C.ink;
  const corner = (rotated: boolean) => {
    ctx.save();
    if (rotated) ctx.rotate(Math.PI);
    ctx.fillStyle = color;
    ctx.font = `700 28px ${fonts.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.rank, x + 22, y + 28);
    drawSuit(ctx, card.suit, x + 22, y + 54, 18);
    ctx.restore();
  };
  corner(false);
  corner(true);

  if (card.rank === 'A') {
    drawSuit(ctx, card.suit, 0, 0, 82);
  } else {
    drawCrown(ctx, 0, -38, 44);
    drawSuit(ctx, card.suit, 0, 18, 58);
  }
  ctx.restore();
}

function drawCardFan(ctx: Ctx, fonts: ShareCardFonts): void {
  const deg = Math.PI / 180;
  const left: FanCard = { rank: 'K', suit: 'H', angle: -15 * deg };
  const right: FanCard = { rank: 'Q', suit: 'D', angle: 15 * deg };
  const centre: FanCard = { rank: 'A', suit: 'S', angle: 0 };
  drawCard(ctx, left, false, fonts);
  drawCard(ctx, right, false, fonts);
  drawCard(ctx, centre, true, fonts);
}

function drawPresents(ctx: Ctx, fonts: ShareCardFonts): void {
  const y = 94;
  const text = 'Game of Cards presents';
  ctx.save();
  ctx.font = `italic 500 24px ${fonts.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.gold200;
  ctx.fillText(text, COL_X, y, COL_WIDTH);
  const half = Math.min(ctx.measureText(text).width, COL_WIDTH) / 2;
  ctx.strokeStyle = C.gold500;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(COL_X - half - 90, y);
  ctx.lineTo(COL_X - half - 18, y);
  ctx.moveTo(COL_X + half + 18, y);
  ctx.lineTo(COL_X + half + 90, y);
  ctx.stroke();
  ctx.restore();
  drawSuit(ctx, 'D', COL_X - half - 100, y, 12);
  drawSuit(ctx, 'D', COL_X + half + 100, y, 12);
}

function drawTitle(ctx: Ctx, title: string, fonts: ShareCardFonts): void {
  ctx.save();
  const { size, lines } = fitTitle(ctx, title, fonts);
  const lineHeight = size * TITLE_LINE_HEIGHT;
  const blockTop = TITLE_TOP + (TITLE_HEIGHT - lines.length * lineHeight) / 2;
  const foil = ctx.createLinearGradient(0, blockTop, 0, blockTop + lines.length * lineHeight);
  foil.addColorStop(0, C.gold100);
  foil.addColorStop(0.38, C.gold300);
  foil.addColorStop(0.62, C.gold500);
  foil.addColorStop(1, C.gold200);
  ctx.font = titleFont(size, fonts);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  lines.forEach((line, index) => {
    const y = blockTop + lineHeight * (index + 0.5);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.strokeStyle = 'rgba(59, 42, 6, 0.9)';
    ctx.lineWidth = Math.max(2, size / 22);
    ctx.strokeText(line, COL_X, y, COL_WIDTH);
    ctx.restore();
    ctx.fillStyle = foil;
    ctx.fillText(line, COL_X, y, COL_WIDTH);
  });
  ctx.restore();
}

/** Draws film, blurb and the "Won at …" ribbon; returns nothing (fixed layout below). */
function drawDetails(ctx: Ctx, data: ShareCardData, fonts: ShareCardFonts): void {
  let y = TITLE_TOP + TITLE_HEIGHT + 30;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const film = data.film?.trim();
  if (film) {
    ctx.font = `italic 400 26px ${fonts.display}`;
    ctx.fillStyle = C.cream;
    ctx.fillText(ellipsize(ctx, `Inspired by ${film}`, COL_WIDTH), COL_X, y, COL_WIDTH);
    y += 36;
  }

  const blurb = data.blurb?.trim();
  if (blurb) {
    ctx.font = `500 20px ${fonts.sans}`;
    ctx.fillStyle = C.parchment;
    for (const line of clampLines(ctx, blurb, COL_WIDTH - 40, 2)) {
      ctx.fillText(line, COL_X, y, COL_WIDTH - 40);
      y += 26;
    }
  }

  // Velvet ribbon with the result.
  const ribbonY = Math.max(y + 34, 448);
  const jeet = formatJeet(data.jeet);
  const verb = Number.isFinite(data.jeet) && data.jeet > 0 ? 'Won at' : 'Played';
  const game = data.gameName.trim();
  const text = game ? `${verb} ${game} · ${jeet} Jeet` : `${jeet} Jeet`;
  // Shrink the type (rather than squeezing the glyphs) until the text fits the ribbon.
  let ribbonFont = RIBBON_FONT_MAX;
  ctx.font = `700 ${ribbonFont}px ${fonts.sans}`;
  while (
    ribbonFont > RIBBON_FONT_MIN &&
    ctx.measureText(text).width + RIBBON_PADDING > RIBBON_MAX_WIDTH
  ) {
    ribbonFont -= 2;
    ctx.font = `700 ${ribbonFont}px ${fonts.sans}`;
  }
  const ribbonW = Math.min(RIBBON_MAX_WIDTH, ctx.measureText(text).width + RIBBON_PADDING);
  const ribbonH = 56;
  const velvet = ctx.createLinearGradient(0, ribbonY - ribbonH / 2, 0, ribbonY + ribbonH / 2);
  velvet.addColorStop(0, C.velvet500);
  velvet.addColorStop(1, C.velvet700);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  addRoundedRect(ctx, COL_X - ribbonW / 2, ribbonY - ribbonH / 2, ribbonW, ribbonH, ribbonH / 2);
  ctx.fillStyle = velvet;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  addRoundedRect(ctx, COL_X - ribbonW / 2, ribbonY - ribbonH / 2, ribbonW, ribbonH, ribbonH / 2);
  ctx.strokeStyle = goldGradient(ctx, COL_X - ribbonW / 2, 0, COL_X + ribbonW / 2, 0);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.gold100;
  // maxWidth is only a safety net (e.g. a fallback font): keep 24 px of velvet each side.
  ctx.fillText(text, COL_X, ribbonY + 1, ribbonW - 48);
  ctx.restore();
}

function drawFooter(ctx: Ctx, data: ShareCardData, fonts: ShareCardFonts): void {
  const left = FRAME_INNER + 40;
  const right = W - FRAME_INNER - 40;
  const lineY = 514;
  const y = 548;
  ctx.save();
  ctx.strokeStyle = goldGradient(ctx, left, 0, right, 0);
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, lineY);
  ctx.lineTo(right, lineY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = `600 18px ${fonts.sans}`;
  ctx.fillStyle = C.mist;
  ctx.textAlign = 'left';
  ctx.fillText(data.dateLabel.trim(), left, y, 300);
  ctx.textAlign = 'right';
  ctx.fillText(displayUrl(data.siteUrl), right, y, 300);
  ctx.textAlign = 'center';
  ctx.font = `italic 500 21px ${fonts.display}`;
  ctx.fillStyle = C.gold200;
  ctx.fillText('Pretend money. Real bragging rights.', W / 2, y, 400);
  ctx.restore();
}

/**
 * Draws the full poster onto a 1200×630 area of `ctx` (any existing transform is
 * respected, so callers may pre-scale for high-DPI canvases). Every save() is restored.
 */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  fonts: ShareCardFonts = DEFAULT_SHARE_CARD_FONTS,
): void {
  const title = data.title.trim() || 'Game of Cards Champion';
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  drawFelt(ctx);
  drawTextScrim(ctx);
  drawFrame(ctx);
  drawBulbs(ctx);
  drawCardFan(ctx, fonts);
  drawPresents(ctx, fonts);
  drawTitle(ctx, title, fonts);
  drawDetails(ctx, data, fonts);
  drawFooter(ctx, data, fonts);
  ctx.restore();
}

// ── Browser helpers ────────────────────────────────────────────────────────────

const FONT_WAIT_MS = 1500;

/**
 * Font families as actually registered on the page: next/font exposes hashed family names
 * through the --font-fraunces / --font-jakarta CSS variables on <html>.
 */
export function resolveShareCardFonts(): ShareCardFonts {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return DEFAULT_SHARE_CARD_FONTS;
  }
  const style = getComputedStyle(document.documentElement);
  const display = style.getPropertyValue('--font-fraunces').trim();
  const sans = style.getPropertyValue('--font-jakarta').trim();
  return {
    display: display
      ? `${display}, ${DEFAULT_SHARE_CARD_FONTS.display}`
      : DEFAULT_SHARE_CARD_FONTS.display,
    sans: sans ? `${sans}, ${DEFAULT_SHARE_CARD_FONTS.sans}` : DEFAULT_SHARE_CARD_FONTS.sans,
  };
}

/** Best effort: make sure the poster fonts are loaded, but never wait more than 1.5 s. */
async function waitForFonts(fonts: ShareCardFonts): Promise<void> {
  const set = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!set || typeof set.load !== 'function') return;
  const loads = Promise.all([
    set.load(titleFont(64, fonts)),
    set.load(`italic 400 26px ${fonts.display}`),
    // The upright face is a separate file (used for the card ranks).
    set.load(`700 28px ${fonts.display}`),
    set.load(`700 30px ${fonts.sans}`),
  ]).then(
    () => undefined,
    () => undefined,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_WAIT_MS);
  });
  await Promise.race([loads, timeout]);
  if (timer !== undefined) clearTimeout(timer);
}

/** Renders the poster to a PNG blob (browser only). */
export async function createShareImage(data: ShareCardData): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('createShareImage can only run in the browser.');
  }
  const fonts = resolveShareCardFonts();
  await waitForFonts(fonts);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw share cards (no 2D canvas).');
  drawShareCard(ctx, data, fonts);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create the share image.'));
    }, 'image/png');
  });
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

/**
 * Shares the image through the native share sheet when the browser can share files,
 * otherwise downloads it. If the learner dismisses the share sheet the promise rejects
 * with the browser's AbortError (callers should simply ignore it); any other share
 * failure falls back to a download.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  text: string,
): Promise<'shared' | 'downloaded'> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (
    nav &&
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    typeof File !== 'undefined'
  ) {
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    const payload: ShareData = { files: [file], text };
    if (nav.canShare(payload)) {
      try {
        await nav.share(payload);
        return 'shared';
      } catch (error) {
        if (isAbortError(error)) throw error;
      }
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
