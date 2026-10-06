/**
 * Closing call-to-action band: a velvet curtain with one last nudge towards the primer and
 * the catalog. Server component.
 */
import { Button } from '@/components/ui/Button';
import { CardsIcon, ChevronRightIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { START_HREF } from './pick-data';

export function ClosingCta() {
  return (
    <section
      aria-labelledby="closing-title"
      className="border-gold-300/30 relative isolate overflow-hidden border-y [contain-intrinsic-size:auto_470px] [content-visibility:auto] lg:[contain-intrinsic-size:auto_450px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(90%_130%_at_50%_0%,#9e2036,#5a0f1f_45%,#2a0710_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [background-image:repeating-linear-gradient(90deg,rgb(0_0_0/0.28)_0_10px,transparent_18px,rgb(255_255_255/0.05)_26px,transparent_34px)] opacity-40"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(45%_100%_at_50%_0%,rgb(255_236_170/0.25),transparent_75%)]"
      />
      <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="text-gold-200 text-xs font-bold tracking-[0.24em] uppercase">
          {t('landing.closing.eyebrow')}
        </p>
        <h2
          id="closing-title"
          className="font-display text-foil mt-3 text-[2.25rem] leading-[1.05] font-black tracking-[-0.02em] text-balance sm:text-5xl"
        >
          {t('landing.closing.title')}
        </h2>
        <p className="text-cream mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          {t('landing.closing.body')}
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button
            href={START_HREF}
            size="lg"
            data-testid="cta-start-closing"
            trailingIcon={<ChevronRightIcon size={20} />}
          >
            {t('landing.closing.ctaStart')}
          </Button>
          <Button href="/games" size="lg" variant="secondary" leadingIcon={<CardsIcon size={20} />}>
            {t('landing.closing.ctaBrowse')}
          </Button>
        </div>
      </div>
    </section>
  );
}
