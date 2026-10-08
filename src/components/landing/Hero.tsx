/**
 * Landing hero: full-bleed felt under a warm spotlight (vignette + film grain + velvet
 * curtains), the poster headline (the page's LCP element — rendered immediately, never
 * faded in), both CTAs, and the stage: the marquee Wordmark (desktop) over the animated
 * DeckShowcase in a reserved 16:9 box.
 *
 * Server component; the only client islands are the DeckShowcase and the PickAGame
 * trigger (whose dialog code is loaded on demand).
 */
import { type CSSProperties } from 'react';
import { DeckShowcase } from '@/components/cards/DeckShowcase';
import { Wordmark } from '@/components/layout/Wordmark';
import { Button } from '@/components/ui/Button';
import { ChevronRightIcon } from '@/components/ui/icons';
import { CoinIcon, formatJeet } from '@/components/ui/Jeet';
import { t } from '@/lib/i18n';
import { PickAGame } from './PickAGame';
import { START_HREF, START_JEET, type PickableGame } from './pick-data';

/** Fine, high-frequency film grain (tiled SVG noise, rasterised once). */
const GRAIN: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.15' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")",
};

/** Theatre curtain folds. */
const CURTAIN: CSSProperties = {
  backgroundImage:
    'linear-gradient(90deg, rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.55)), repeating-linear-gradient(90deg, #4a0c19 0 6px, #9e2036 14px, #741628 22px, #4a0c19 30px)',
  maskImage: 'linear-gradient(to bottom, #000 55%, transparent)',
  WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent)',
};
const CURTAIN_RIGHT: CSSProperties = {
  ...CURTAIN,
  backgroundImage:
    'linear-gradient(270deg, rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.55)), repeating-linear-gradient(90deg, #4a0c19 0 6px, #9e2036 14px, #741628 22px, #4a0c19 30px)',
};

export interface HeroProps {
  /** Slim records for the "Pick a game for me" dialog. */
  games: readonly PickableGame[];
  gameCount: number;
}

export function Hero({ games, gameCount }: HeroProps) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* felt, spotlight, vignette, grain, curtains */}
      <div aria-hidden="true" className="felt absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(85%_55%_at_50%_0%,rgb(255_236_170/0.2),transparent_70%)] lg:bg-[radial-gradient(50%_75%_at_74%_8%,rgb(255_236_170/0.22),transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(130%_95%_at_50%_40%,transparent_50%,rgb(3_17_11/0.88)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.16] mix-blend-overlay"
        style={GRAIN}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 -z-10 hidden w-10 md:block xl:w-16"
        style={CURTAIN}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 -z-10 hidden w-10 md:block xl:w-16"
        style={CURTAIN_RIGHT}
      />

      <div className="mx-auto grid max-w-[1200px] items-center gap-x-10 gap-y-4 px-4 pt-5 pb-12 sm:px-8 sm:pt-8 sm:pb-16 md:px-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:pt-14 lg:pb-24 xl:px-8">
        <div className="text-center lg:text-left">
          <p className="border-gold-300/40 bg-felt-950/55 text-gold-200 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.6875rem] font-bold tracking-[0.22em] uppercase sm:text-xs">
            <span aria-hidden="true" className="animate-bulb bg-gold-300 size-1.5 rounded-full" />
            {gameCount > 0
              ? t('landing.hero.eyebrow', { count: gameCount })
              : t('landing.hero.eyebrowNoCount')}
          </p>
          <h1
            id="hero-title"
            className="font-display mt-4 text-[2.625rem] leading-[1.02] font-black tracking-[-0.02em] text-balance drop-shadow-[0_6px_18px_rgb(0_0_0/0.45)] sm:text-6xl lg:text-[4.5rem]"
          >
            <span className="text-foil block">{t('landing.hero.titleLead')}</span>{' '}
            <span className="text-foil block pb-1 italic">{t('landing.hero.titleAccent')}</span>
          </h1>
          <p className="text-cream/90 mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty sm:text-lg lg:mx-0">
            {t('landing.hero.subhead')}
          </p>
          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
            <Button
              href={START_HREF}
              size="lg"
              className="sm:whitespace-nowrap"
              data-testid="cta-start"
              trailingIcon={<ChevronRightIcon size={20} />}
            >
              {t('landing.hero.ctaStart')}
            </Button>
            <PickAGame games={games} className="sm:whitespace-nowrap" />
          </div>
          <p className="text-mist mt-5 inline-flex items-center gap-2 text-sm leading-snug">
            <CoinIcon size={18} className="shrink-0" />
            <span>{t('landing.hero.note', { amount: formatJeet(START_JEET) })}</span>
          </p>
        </div>

        {/* The stage: shown first on phones, to the right on desktop. Space is reserved by
            the showcase's fixed aspect ratio, so nothing shifts when it starts. */}
        <div className="relative order-first mx-auto w-full max-w-[20rem] min-[400px]:max-w-[22rem] sm:max-w-[28rem] lg:order-none lg:max-w-none">
          <div
            aria-hidden="true"
            className="from-gold-100/20 pointer-events-none absolute -top-24 left-1/2 h-[calc(100%+6rem)] w-[110%] -translate-x-1/2 bg-linear-to-b to-transparent [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)] max-lg:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[4%] top-[34%] bottom-[-6%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(43_143_102/0.45),transparent)]"
          />
          {/* The marquee sign hung over the table. Desktop only: on phones and tablets the
              header's sign sits directly above the hero already. Decorative (the header
              link carries the name); its bulbs twinkle in CSS, so reduced motion stops them. */}
          <div className="relative mx-auto mb-2 hidden w-[17.5rem] lg:block xl:w-[19rem] [&>svg]:w-full">
            <Wordmark size="lg" decorative />
          </div>
          <DeckShowcase className="w-full" />
        </div>
      </div>

      {/* marquee bulbs along the bottom edge */}
      <div aria-hidden="true" className="relative h-3.5">
        <div className="via-gold-300/60 absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent" />
        <div className="marquee-bulbs absolute inset-x-0 top-0.5 bottom-0 opacity-45" />
        <div className="marquee-bulbs animate-bulb absolute inset-x-0 top-0.5 bottom-0 [background-size:28px_28px] [background-position:-7px_-7px]" />
      </div>
    </section>
  );
}
