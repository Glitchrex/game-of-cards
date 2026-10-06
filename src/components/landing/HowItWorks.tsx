/**
 * "How it works": Discover → Learn → Try → Play, with tiny original SVG icons, laid out
 * like frames on a strip of film. Server component.
 */
import { type ReactNode } from 'react';
import { SUIT_PATHS } from '@/components/cards/suits';
import { t } from '@/lib/i18n';

const STEP_IDS = ['discover', 'learn', 'try', 'play'] as const;
type StepId = (typeof STEP_IDS)[number];

function StepSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={40}
      height={40}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const { S: SPADE, H: HEART } = SUIT_PATHS;

const ICONS: Record<StepId, ReactNode> = {
  // A card under a magnifying glass.
  discover: (
    <StepSvg>
      <rect x="5" y="6" width="17" height="24" rx="2.5" transform="rotate(-8 13.5 18)" />
      <path d={HEART} transform="translate(9 13) scale(0.08)" fill="currentColor" stroke="none" />
      <circle cx="25" cy="22" r="7.5" />
      <path d="M30.5 27.5L36 33" strokeWidth={3} />
    </StepSvg>
  ),
  // An open book with a spade on its page.
  learn: (
    <StepSvg>
      <path d="M20 11c-4-3-9-3.5-15-2.5v21c6-1 11-.5 15 2.5 4-3 9-3.5 15-2.5v-21c-6-1-11-.5-15 2.5z" />
      <path d="M20 11v21" />
      <path d={SPADE} transform="translate(24 15) scale(0.08)" fill="currentColor" stroke="none" />
      <path d="M9 15h6M9 19h6M9 23h4" strokeWidth={1.6} />
    </StepSvg>
  ),
  // A hand of cards with the coach's pick lifted and sparkling.
  try: (
    <StepSvg>
      <rect x="6" y="13" width="12" height="17" rx="2" transform="rotate(-14 12 21.5)" />
      <rect x="22" y="13" width="12" height="17" rx="2" transform="rotate(14 28 21.5)" />
      <rect x="14" y="7" width="12" height="17" rx="2" fill="currentColor" fillOpacity="0.18" />
      <path
        d="M31 4l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M17 31l3 3 3-3" />
    </StepSvg>
  ),
  // A stack of pretend coins with a little crown.
  play: (
    <StepSvg>
      <ellipse cx="20" cy="30" rx="11" ry="4" />
      <path d="M9 30v-4c0 2.2 4.9 4 11 4s11-1.8 11-4v4" />
      <ellipse cx="20" cy="22" rx="11" ry="4" />
      <path d="M9 22v4M31 22v4" />
      <path d="M13 13l3 3 4-6 4 6 3-3-1.5 6h-11z" fill="currentColor" fillOpacity="0.2" />
    </StepSvg>
  ),
};

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-title" className="relative py-14 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-gold-300 text-xs font-bold tracking-[0.24em] uppercase">
            {t('landing.howItWorks.eyebrow')}
          </p>
          <h2
            id="how-it-works-title"
            className="font-display text-gold-100 mt-2 text-3xl leading-tight font-bold sm:text-[2.5rem]"
          >
            {t('landing.howItWorks.title')}
          </h2>
          <p className="text-mist mt-3 text-base leading-relaxed text-pretty">
            {t('landing.howItWorks.intro')}
          </p>
        </header>

        <div className="relative mt-10">
          {/* the film-strip rail that connects the frames on wide screens */}
          <div
            aria-hidden="true"
            className="border-gold-300/35 pointer-events-none absolute top-[3.25rem] right-[12%] left-[12%] hidden border-t-2 border-dashed lg:block"
          />
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {STEP_IDS.map((id, i) => (
              <li key={id} className="panel bg-felt-900 relative flex flex-col p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="border-gold-300/50 bg-felt-950 text-gold-200 relative inline-flex size-[3.75rem] shrink-0 items-center justify-center rounded-2xl border shadow-[0_0_24px_-6px_rgb(245_215_122/0.5)]">
                    {ICONS[id]}
                  </span>
                  <div>
                    <p className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.2em] uppercase">
                      {t('landing.howItWorks.stepLabel', { n: i + 1 })}
                    </p>
                    <h3 className="font-display text-gold-100 text-xl leading-tight font-bold sm:text-2xl">
                      {t(`landing.howItWorks.steps.${id}.title`)}
                    </h3>
                  </div>
                </div>
                <p className="text-mist mt-3 text-[0.9375rem] leading-relaxed">
                  {t(`landing.howItWorks.steps.${id}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
