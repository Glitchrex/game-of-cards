/**
 * The original "Game of Cards" wordmark: foil serif lettering inside a
 * cinema-marquee plate ringed with bulbs, with a spade/heart flourish around a
 * small italic "of". Pure SVG (server-safe). `textLength` keeps the geometry
 * identical whether the display font or its fallback renders.
 *
 *  sm  → single-line marquee for the header
 *  md  → stacked sign for the footer / panels
 *  lg  → stacked hero sign (twinkles by default)
 */
import { useId } from 'react';
import { siteConfig } from '@/config/site';
import { cn } from '@/components/ui/cn';

export type WordmarkSize = 'sm' | 'md' | 'lg';

export interface WordmarkProps {
  size?: WordmarkSize;
  /** Chase-light animation on the bulbs (stopped automatically for reduced motion). */
  twinkle?: boolean;
  /** Hide from assistive tech (e.g. when the parent link already has a label). */
  decorative?: boolean;
  className?: string;
}

interface Bulb {
  x: number;
  y: number;
}

/** Evenly spaced bulbs along the four edges of a rectangle (corners excluded). */
function bulbTrack(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  step: number,
  corner: number,
): Bulb[] {
  const out: Bulb[] = [];
  const row = (y: number) => {
    const a = x0 + corner;
    const b = x1 - corner;
    const n = Math.max(1, Math.round((b - a) / step));
    for (let i = 0; i <= n; i++) out.push({ x: a + ((b - a) * i) / n, y });
  };
  const col = (x: number) => {
    const a = y0 + corner;
    const b = y1 - corner;
    const n = Math.max(1, Math.round((b - a) / step));
    for (let i = 1; i < n; i++) out.push({ x, y: a + ((b - a) * i) / n });
    if (n === 1) out.push({ x, y: (a + b) / 2 });
  };
  row(y0);
  col(x1);
  row(y1);
  col(x0);
  return out.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}

const SPADE =
  'M12 2.5c-.4 0-.8.2-1 .5C8.6 6 4 9.1 4 13.1 4 15.8 6 17.6 8.3 17.6c1.2 0 2.2-.4 2.9-1.1-.2 1.9-.9 3.3-2.2 4.1-.4.3-.2.9.3.9h5.4c.5 0 .7-.6.3-.9-1.3-.8-2-2.2-2.2-4.1.7.7 1.7 1.1 2.9 1.1 2.3 0 4.3-1.8 4.3-4.5 0-4-4.6-7.1-7-10.1-.2-.3-.6-.5-1-.5Z';
const HEART =
  'M12 21c-.3 0-.6-.1-.8-.3C7 17.2 3 13.7 3 9.3 3 6.4 5.2 4 8 4c1.7 0 3.1.8 4 2.1C12.9 4.8 14.3 4 16 4c2.8 0 5 2.4 5 5.3 0 4.4-4 7.9-8.2 11.4-.2.2-.5.3-.8.3Z';

const INLINE = { w: 184, h: 44, bulbs: bulbTrack(5.5, 5.5, 178.5, 38.5, 10, 6) };
const STACKED = { w: 240, h: 124, bulbs: bulbTrack(8, 8, 232, 116, 12.5, 9) };

const widths: Record<WordmarkSize, string> = {
  sm: 'w-[132px]',
  md: 'w-[176px]',
  lg: 'w-[min(320px,82vw)]',
};

export function Wordmark({ size = 'md', twinkle, decorative = false, className }: WordmarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ids = {
    plate: `wm-plate-${uid}`,
    rim: `wm-rim-${uid}`,
    foil: `wm-foil-${uid}`,
    glow: `wm-glow-${uid}`,
    bulb: `wm-bulb-${uid}`,
    halo: `wm-halo-${uid}`,
  };
  const inline = size === 'sm';
  const geo = inline ? INLINE : STACKED;
  const animate = twinkle ?? size === 'lg';
  const a11y = decorative
    ? ({ 'aria-hidden': true, focusable: 'false' } as const)
    : ({ role: 'img', 'aria-label': siteConfig.name } as const);
  const display = { fontFamily: 'var(--font-display)' } as const;
  const bulbR = inline ? 1.35 : 2.1;

  return (
    <svg
      viewBox={`0 0 ${geo.w} ${geo.h}`}
      className={cn('block h-auto shrink-0 select-none', widths[size], className)}
      {...a11y}
    >
      {decorative ? null : <title>{siteConfig.name}</title>}
      <defs>
        <radialGradient id={ids.plate} cx="0.5" cy="0.42" r="0.75">
          <stop offset="0" stopColor="#3a0d18" />
          <stop offset="0.45" stopColor="#14301f" />
          <stop offset="1" stopColor="#03110b" />
        </radialGradient>
        <linearGradient id={ids.rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6d9" />
          <stop offset="0.35" stopColor="#ecc153" />
          <stop offset="0.7" stopColor="#8a6312" />
          <stop offset="1" stopColor="#f5d77a" />
        </linearGradient>
        <linearGradient id={ids.foil} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d9" />
          <stop offset="0.42" stopColor="#f5d77a" />
          <stop offset="0.7" stopColor="#d6a42c" />
          <stop offset="1" stopColor="#fbe8a6" />
        </linearGradient>
        <radialGradient id={ids.bulb} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#fbe8a6" />
          <stop offset="1" stopColor="#d6a42c" />
        </radialGradient>
        <radialGradient id={ids.halo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f5d77a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f5d77a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c22f47" stopOpacity="0.35" />
          <stop offset="1" stopColor="#c22f47" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Plate + gold rim */}
      <rect
        x="1.25"
        y="1.25"
        width={geo.w - 2.5}
        height={geo.h - 2.5}
        rx={inline ? 11 : 18}
        fill={`url(#${ids.plate})`}
        stroke={`url(#${ids.rim})`}
        strokeWidth={inline ? 1.6 : 2.5}
      />
      <ellipse
        cx={geo.w / 2}
        cy={geo.h / 2}
        rx={geo.w * 0.42}
        ry={geo.h * 0.38}
        fill={`url(#${ids.glow})`}
      />
      {inline ? null : (
        <rect
          x="15"
          y="15"
          width={geo.w - 30}
          height={geo.h - 30}
          rx="9"
          fill="none"
          stroke="#f5d77a"
          strokeOpacity="0.45"
          strokeWidth="0.8"
        />
      )}

      {/* Marquee bulbs */}
      <g>
        {geo.bulbs.map((b, i) => (
          <g
            key={i}
            className={animate ? 'animate-bulb' : undefined}
            style={animate ? { animationDelay: `${(i % 3) * 0.8}s` } : undefined}
          >
            <circle cx={b.x} cy={b.y} r={bulbR * 2.6} fill={`url(#${ids.halo})`} />
            <circle cx={b.x} cy={b.y} r={bulbR} fill={`url(#${ids.bulb})`} />
          </g>
        ))}
      </g>

      {inline ? (
        <g style={display} fill={`url(#${ids.foil})`} stroke="#2a1d04" strokeWidth="0.5">
          <text
            x="15"
            y="29"
            fontSize="20"
            fontWeight="800"
            textLength="62"
            lengthAdjust="spacing"
            paintOrder="stroke"
          >
            GAME
          </text>
          <text
            x="88"
            y="24.5"
            fontSize="12"
            fontStyle="italic"
            fontWeight="600"
            textAnchor="middle"
            textLength="11"
            lengthAdjust="spacingAndGlyphs"
            fill="#fbe8a6"
            stroke="none"
          >
            of
          </text>
          <path
            d={SPADE}
            transform="translate(84.6 26.4) scale(0.29)"
            fill="#f5d77a"
            stroke="none"
          />
          <text
            x="99"
            y="29"
            fontSize="20"
            fontWeight="800"
            textLength="71"
            lengthAdjust="spacing"
            paintOrder="stroke"
          >
            CARDS
          </text>
        </g>
      ) : (
        <g style={display}>
          {/* soft drop shadow */}
          <g fill="#000" fillOpacity="0.55" transform="translate(0 2)">
            <text
              x="120"
              y="52"
              fontSize="36"
              fontWeight="900"
              textAnchor="middle"
              textLength="152"
              lengthAdjust="spacing"
            >
              GAME
            </text>
            <text
              x="120"
              y="103"
              fontSize="36"
              fontWeight="900"
              textAnchor="middle"
              textLength="170"
              lengthAdjust="spacing"
            >
              CARDS
            </text>
          </g>
          <g fill={`url(#${ids.foil})`} stroke="#2a1d04" strokeWidth="0.7" paintOrder="stroke">
            <text
              x="120"
              y="52"
              fontSize="36"
              fontWeight="900"
              textAnchor="middle"
              textLength="152"
              lengthAdjust="spacing"
            >
              GAME
            </text>
            <text
              x="120"
              y="103"
              fontSize="36"
              fontWeight="900"
              textAnchor="middle"
              textLength="170"
              lengthAdjust="spacing"
            >
              CARDS
            </text>
          </g>
          {/* "of" flourish: rules with diamond tips, spade + heart */}
          <g stroke="#f5d77a" strokeWidth="0.9" strokeLinecap="round">
            <line x1="44" y1="66" x2="92" y2="66" strokeOpacity="0.75" />
            <line x1="148" y1="66" x2="196" y2="66" strokeOpacity="0.75" />
          </g>
          <path d="M40 66l3-3 3 3-3 3z" fill="#f5d77a" />
          <path d="M194 66l3-3 3 3-3 3z" fill="#f5d77a" />
          <path d={SPADE} transform="translate(94.5 59.6) scale(0.52)" fill="#f5d77a" />
          <path d={HEART} transform="translate(133.3 59.6) scale(0.52)" fill="#e0566b" />
          <text
            x="120"
            y="71"
            fontSize="17"
            fontStyle="italic"
            fontWeight="600"
            textAnchor="middle"
            textLength="17"
            lengthAdjust="spacingAndGlyphs"
            fill="#fbe8a6"
          >
            of
          </text>
        </g>
      )}
    </svg>
  );
}
