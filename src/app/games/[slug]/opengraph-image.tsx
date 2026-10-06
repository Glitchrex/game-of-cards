import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';
import { getAllGames, getGame } from '@/lib/content/catalog';
import { ogText } from '@/components/catalog/og-text';
import { GAME_TYPE_LABELS } from '@/lib/content/schema';
import { t } from '@/lib/i18n';

export const alt = t('catalog.og.alt');
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllGames().map((g) => ({ slug: g.slug }));
}

const GOLD = '#f5d77a';
const GOLD_DEEP = '#d6a42c';
const CREAM = '#f4ecd8';
const MIST = '#bcd0c3';

function Bulbs({ top }: { top: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 64,
        right: 64,
        [top ? 'top' : 'bottom']: 30,
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: i % 2 ? '#fbe8a6' : GOLD,
            boxShadow: '0 0 12px rgba(245,215,122,0.9)',
          }}
        />
      ))}
    </div>
  );
}

function SpadeMark({ size: s, color }: { size: number; color: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path
        fill={color}
        d="M12 2.5c-.4 0-.8.2-1 .5C8.6 6 4 9.1 4 13.1 4 15.8 6 17.6 8.3 17.6c1.2 0 2.2-.4 2.9-1.1-.2 1.9-.9 3.3-2.2 4.1-.4.3-.2.9.3.9h5.4c.5 0 .7-.6.3-.9-1.3-.8-2-2.2-2.2-4.1.7.7 1.7 1.1 2.9 1.1 2.3 0 4.3-1.8 4.3-4.5 0-4-4.6-7.1-7-10.1-.2-.3-.6-.5-1-.5Z"
      />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGame(slug);
  const name = ogText(game?.name ?? siteConfig.name);
  const hook = ogText(game?.hook ?? siteConfig.tagline);
  const meta = game
    ? ogText(`${game.origin.country} · ${GAME_TYPE_LABELS[game.type]}`)
    : ogText(siteConfig.tagline);
  const nameSize = name.length > 18 ? 84 : name.length > 12 ? 104 : 124;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: 'radial-gradient(circle at 50% 0%, #1a704d 0%, #0e4630 45%, #062417 100%)',
        color: CREAM,
      }}
    >
      {/* gold frame */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: 18,
          right: 18,
          bottom: 18,
          border: `4px solid ${GOLD_DEEP}`,
          borderRadius: 28,
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: 30,
          right: 30,
          bottom: 30,
          border: '1.5px solid rgba(245,215,122,0.45)',
          borderRadius: 20,
          display: 'flex',
        }}
      />
      <Bulbs top />
      <Bulbs top={false} />
      <div
        style={{
          position: 'absolute',
          right: 70,
          top: 120,
          display: 'flex',
          opacity: 0.14,
          transform: 'rotate(14deg)',
        }}
      >
        <SpadeMark size={380} color="#fbf6ea" />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 110px',
          width: '100%',
          height: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 26,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: GOLD,
          }}
        >
          <SpadeMark size={30} color={GOLD} />
          {t('catalog.og.presents', { site: siteConfig.name })}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 18,
            fontSize: nameSize,
            lineHeight: 1,
            letterSpacing: -3,
            color: '#fff6d9',
            textShadow: '0 4px 0 #8a6312, 0 10px 30px rgba(0,0,0,0.6)',
          }}
        >
          {name}
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 28, color: MIST }}>{meta}</div>
        <div
          style={{
            display: 'flex',
            marginTop: 26,
            maxWidth: 820,
            fontSize: 34,
            lineHeight: 1.3,
            color: CREAM,
          }}
        >
          {hook}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 34,
            alignSelf: 'flex-start',
            padding: '12px 26px',
            borderRadius: 999,
            background: GOLD,
            color: '#17161b',
            fontSize: 26,
          }}
        >
          {game?.tier === 2 ? t('catalog.og.ctaNoBot') : t('catalog.og.cta')}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
