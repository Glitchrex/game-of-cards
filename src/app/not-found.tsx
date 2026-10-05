import { Button } from '@/components/ui/Button';
import { CardsIcon, HomeIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';

const SPADE =
  'M12 2.5c-.4 0-.8.2-1 .5C8.6 6 4 9.1 4 13.1 4 15.8 6 17.6 8.3 17.6c1.2 0 2.2-.4 2.9-1.1-.2 1.9-.9 3.3-2.2 4.1-.4.3-.2.9.3.9h5.4c.5 0 .7-.6.3-.9-1.3-.8-2-2.2-2.2-4.1.7.7 1.7 1.1 2.9 1.1 2.3 0 4.3-1.8 4.3-4.5 0-4-4.6-7.1-7-10.1-.2-.3-.6-.5-1-.5Z';
const HEART =
  'M12 21c-.3 0-.6-.1-.8-.3C7 17.2 3 13.7 3 9.3 3 6.4 5.2 4 8 4c1.7 0 3.1.8 4 2.1C12.9 4.8 14.3 4 16 4c2.8 0 5 2.4 5 5.3 0 4.4-4 7.9-8.2 11.4-.2.2-.5.3-.8.3Z';

function FaceCard({ suit }: { suit: 'spade' | 'heart' }) {
  const color = suit === 'spade' ? '#17161b' : '#c4122f';
  const d = suit === 'spade' ? SPADE : HEART;
  return (
    <svg viewBox="0 0 100 140" className="h-full w-full drop-shadow-[0_18px_24px_rgb(0_0_0/0.55)]">
      <rect x="1" y="1" width="98" height="138" rx="8" fill="#fbf6ea" stroke="#d9cdb0" />
      <rect x="6" y="6" width="88" height="128" rx="5" fill="none" stroke="#e8dcc0" />
      <g fill={color}>
        <text
          x="12"
          y="27"
          fontSize="22"
          fontWeight="800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          4
        </text>
        <path d={d} transform="translate(9 31) scale(0.62)" />
        <path d={d} transform="translate(26 48) scale(2)" />
        <g transform="rotate(180 50 70)">
          <text
            x="12"
            y="27"
            fontSize="22"
            fontWeight="800"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            4
          </text>
          <path d={d} transform="translate(9 31) scale(0.62)" />
        </g>
      </g>
    </svg>
  );
}

function CardBack() {
  const rays = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg viewBox="0 0 100 140" className="h-full w-full drop-shadow-[0_22px_28px_rgb(0_0_0/0.6)]">
      <defs>
        <radialGradient id="nf-velvet" cx="0.5" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#c22f47" />
          <stop offset="0.6" stopColor="#741628" />
          <stop offset="1" stopColor="#3d0b15" />
        </radialGradient>
        <clipPath id="nf-inner">
          <rect x="9" y="9" width="82" height="122" rx="5" />
        </clipPath>
      </defs>
      <rect x="1" y="1" width="98" height="138" rx="8" fill="#fbf6ea" />
      <rect x="5" y="5" width="90" height="130" rx="6" fill="url(#nf-velvet)" />
      <g clipPath="url(#nf-inner)" stroke="#f5d77a" strokeOpacity="0.35" strokeWidth="0.8">
        {rays.map((deg) => (
          <line key={deg} x1="50" y1="70" x2="50" y2="-40" transform={`rotate(${deg} 50 70)`} />
        ))}
      </g>
      <rect
        x="9"
        y="9"
        width="82"
        height="122"
        rx="5"
        fill="none"
        stroke="#ecc153"
        strokeWidth="1.2"
      />
      <circle cx="50" cy="70" r="20" fill="#3d0b15" stroke="#ecc153" strokeWidth="1.5" />
      <text
        x="50"
        y="78.5"
        fontSize="24"
        fontWeight="900"
        textAnchor="middle"
        fill="#f5d77a"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        0
      </text>
    </svg>
  );
}

function FilmStrip({ className }: { className?: string }) {
  const holes = Array.from({ length: 9 }, (_, i) => i * 22 + 6);
  return (
    <svg viewBox="0 0 200 56" className={className} aria-hidden="true">
      <rect width="200" height="56" rx="3" fill="#03110b" stroke="#2b8f66" strokeOpacity="0.5" />
      {holes.map((x) => (
        <g key={x} fill="#0e4630">
          <rect x={x} y="4" width="10" height="7" rx="1.5" />
          <rect x={x} y="45" width="10" height="7" rx="1.5" />
        </g>
      ))}
      <rect x="6" y="15" width="188" height="26" fill="#0a3524" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_30%,rgb(245_215_122/0.13),transparent_70%)]"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 pt-12 pb-16 text-center sm:pt-20">
        <div aria-hidden="true" className="relative h-52 w-full max-w-md sm:h-64">
          <FilmStrip className="absolute top-16 -left-6 w-[58%] -rotate-[8deg] opacity-80 sm:top-20" />
          <FilmStrip className="absolute top-24 -right-6 w-[58%] rotate-[10deg] opacity-80 sm:top-28" />
          <svg
            viewBox="0 0 40 40"
            className="text-gold-300 absolute top-14 left-1/2 w-8 -translate-x-1/2 sm:top-16"
          >
            <path
              d="M20 4v32"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute top-6 left-1/2 h-40 w-[6.5rem] -translate-x-[128%] -rotate-[14deg] sm:h-48 sm:w-32">
            <FaceCard suit="spade" />
          </div>
          <div className="absolute top-6 left-1/2 h-40 w-[6.5rem] translate-x-[28%] rotate-[14deg] sm:h-48 sm:w-32">
            <FaceCard suit="heart" />
          </div>
          <div className="animate-float absolute top-0 left-1/2 h-40 w-[6.5rem] -translate-x-1/2 sm:h-48 sm:w-32">
            <CardBack />
          </div>
        </div>

        <p className="text-gold-300 mt-8 text-xs font-bold tracking-[0.26em] uppercase">
          {t('common.notFound.eyebrow')}
        </p>
        <h1 className="font-display text-foil mt-3 text-[2.5rem] leading-[1.05] font-black tracking-[-0.02em] text-balance sm:text-6xl">
          {t('common.notFound.title')}
        </h1>
        <p className="text-mist mt-4 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          {t('common.notFound.body')}
        </p>
        <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button href="/" size="lg" leadingIcon={<HomeIcon size={20} />}>
            {t('common.notFound.home')}
          </Button>
          <Button href="/games" size="lg" variant="secondary" leadingIcon={<CardsIcon size={20} />}>
            {t('common.notFound.games')}
          </Button>
        </div>
      </div>
    </div>
  );
}
