/**
 * The site-wide social share image (1200 × 630), rendered with next/og: a felt table
 * under a spotlight, a gold marquee frame ringed with bulbs, the name and tagline, and a
 * fan of drawn cards. Uses next/og's bundled font only (nothing is fetched), and inline
 * SVG suit shapes instead of suit glyphs so no extra font is ever needed.
 *
 * Shared by src/app/opengraph-image.tsx and src/app/twitter-image.tsx.
 */
import { ImageResponse } from 'next/og';
import { SUIT_PATHS } from '@/components/cards/suits';
import { siteConfig } from '@/config/site';
import { type Suit } from '@/games/core/cards';
import { t } from '@/lib/i18n';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ALT = t('landing.og.alt', { name: siteConfig.name, tagline: siteConfig.tagline });

/** "Learn every card game." / "The fun way." — one sentence per line. */
const TAGLINE_LINES = siteConfig.tagline.split(/(?<=\.)\s+/);

const GOLD = '#f5d77a';
const CREAM = '#f4ecd8';
const MIST = '#bcd0c3';

const FAN: readonly { rank: string; suit: Suit }[] = [
  { rank: '10', suit: 'H' },
  { rank: 'J', suit: 'S' },
  { rank: 'Q', suit: 'D' },
  { rank: 'K', suit: 'C' },
  { rank: 'A', suit: 'H' },
];

const CARD_W = 130;
const CARD_H = 182;
/** Fan pivot (centre of the arc), radius and spread, in image pixels / degrees. */
const PIVOT = { x: 920, y: 800 };
const RADIUS = 430;
const STEP_DEG = 9;

function SuitShape({ suit, size }: { suit: Suit; size: number }) {
  const red = suit === 'H' || suit === 'D';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d={SUIT_PATHS[suit]} fill={red ? '#c4122f' : '#17161b'} />
    </svg>
  );
}

function DrawnCard({ rank, suit, angle }: { rank: string; suit: Suit; angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const cx = PIVOT.x + RADIUS * Math.sin(rad);
  const cy = PIVOT.y - RADIUS * Math.cos(rad);
  const red = suit === 'H' || suit === 'D';
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(cx - CARD_W / 2),
        top: Math.round(cy - CARD_H / 2),
        width: CARD_W,
        height: CARD_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        backgroundColor: '#fbf6ea',
        border: '1px solid #d9cdb0',
        boxShadow: '0 18px 30px rgba(0, 0, 0, 0.5)',
        transform: `rotate(${angle}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: red ? '#c4122f' : '#17161b',
          fontSize: 30,
          lineHeight: 1,
        }}
      >
        <div style={{ display: 'flex' }}>{rank}</div>
        <SuitShape suit={suit} size={20} />
      </div>
      <SuitShape suit={suit} size={62} />
    </div>
  );
}

function Bulb() {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundImage: 'radial-gradient(circle at 40% 35%, #ffffff, #fbe8a6 45%, #d6a42c)',
        boxShadow: '0 0 10px 3px rgba(245, 215, 122, 0.55)',
      }}
    />
  );
}

function BulbRow({ count, vertical, style }: { count: number; vertical?: boolean; style: object }) {
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        justifyContent: 'space-between',
        ...style,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Bulb key={i} />
      ))}
    </div>
  );
}

export function SiteOgArt() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        backgroundColor: '#062417',
        backgroundImage:
          'radial-gradient(circle at 62% 18%, #1a704d 0%, #0e4630 30%, #062417 62%, #03110b 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      {/* spotlight */}
      <div
        style={{
          position: 'absolute',
          left: 520,
          top: -120,
          width: 760,
          height: 620,
          display: 'flex',
          borderRadius: 380,
          backgroundImage:
            'radial-gradient(circle, rgba(255, 236, 170, 0.22) 0%, rgba(255, 236, 170, 0) 70%)',
        }}
      />
      {/* gold marquee frame */}
      <div
        style={{
          position: 'absolute',
          left: 26,
          top: 26,
          right: 26,
          bottom: 26,
          display: 'flex',
          borderRadius: 30,
          border: `4px solid #ecc153`,
          boxShadow: '0 0 0 2px #8a6312, inset 0 0 0 2px rgba(255, 246, 217, 0.35)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 50,
          top: 50,
          right: 50,
          bottom: 50,
          display: 'flex',
          borderRadius: 20,
          border: '1.5px solid rgba(245, 215, 122, 0.45)',
        }}
      />
      <BulbRow count={34} style={{ left: 60, right: 60, top: 32 }} />
      <BulbRow count={34} style={{ left: 60, right: 60, bottom: 32 }} />
      <BulbRow count={15} vertical style={{ top: 60, bottom: 60, left: 32 }} />
      <BulbRow count={15} vertical style={{ top: 60, bottom: 60, right: 32 }} />

      {/* the card fan (drawn before the text so the words sit on top) */}
      {FAN.map((c, i) => (
        <DrawnCard
          key={i}
          rank={c.rank}
          suit={c.suit}
          angle={(i - (FAN.length - 1) / 2) * STEP_DEG}
        />
      ))}

      {/* name */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 96,
          right: 96,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            color: GOLD,
            fontSize: 22,
            letterSpacing: 7,
            textTransform: 'uppercase',
          }}
        >
          {t('landing.og.eyebrow')}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 14,
            color: GOLD,
            fontSize: 112,
            lineHeight: 1,
            letterSpacing: -3,
            textShadow: '0 4px 18px rgba(0, 0, 0, 0.55)',
          }}
        >
          {siteConfig.name}
        </div>
      </div>

      {/* tagline + promise, bottom left (clear of the card fan) */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 282,
          width: 560,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {TAGLINE_LINES.map((line) => (
          <div key={line} style={{ display: 'flex', color: CREAM, fontSize: 46, lineHeight: 1.15 }}>
            {line}
          </div>
        ))}
        <div style={{ display: 'flex', marginTop: 20, color: MIST, fontSize: 26, lineHeight: 1.3 }}>
          {t('landing.og.features')}
        </div>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            marginTop: 26,
            padding: '9px 22px',
            borderRadius: 999,
            border: '2px solid rgba(245, 215, 122, 0.6)',
            backgroundColor: 'rgba(3, 17, 11, 0.6)',
            color: GOLD,
            fontSize: 24,
          }}
        >
          {t('landing.og.promise')}
        </div>
      </div>
    </div>
  );
}

/** The PNG response for the opengraph-image / twitter-image routes. */
export function renderSiteOgImage(): ImageResponse {
  return new ImageResponse(<SiteOgArt />, { ...OG_SIZE });
}
