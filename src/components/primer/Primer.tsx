'use client';
/**
 * Card Basics primer: a ~60-second, one-idea-per-screen interactive intro.
 * Back/Next buttons and the ←/→ keys move between screens; "Skip" and the final
 * button mark the primer as seen and continue to the safe ?next= target.
 */
import { Suspense, useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { announce } from '@/components/layout/LiveAnnouncer';
import { type TKey, t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { useSettings } from '@/store/settings';
import { ProgressBar } from './ProgressBar';
import { DEFAULT_NEXT, safeNextPath } from './safeNext';
import { finishButton, primaryButton, secondaryButton } from './styles';
import { DeckScreen } from './screens/DeckScreen';
import { SuitsScreen } from './screens/SuitsScreen';
import { RanksScreen } from './screens/RanksScreen';
import { FacesScreen } from './screens/FacesScreen';
import { HandScreen } from './screens/HandScreen';
import { TRICK, TRUMP, TrickScreen } from './screens/TrickScreen';
import { MeldScreen } from './screens/MeldScreen';
import { DoneScreen } from './screens/DoneScreen';

interface ScreenDef {
  title: TKey;
  render: (focusHeading: boolean) => ReactNode;
}

const SCREENS: ScreenDef[] = [
  { title: 'primer.screens.deck.title', render: (f) => <DeckScreen focusHeading={f} /> },
  { title: 'primer.screens.suits.title', render: (f) => <SuitsScreen focusHeading={f} /> },
  { title: 'primer.screens.ranks.title', render: (f) => <RanksScreen focusHeading={f} /> },
  { title: 'primer.screens.faces.title', render: (f) => <FacesScreen focusHeading={f} /> },
  { title: 'primer.screens.hand.title', render: (f) => <HandScreen focusHeading={f} /> },
  {
    title: 'primer.screens.trick.title',
    render: (f) => <TrickScreen config={TRICK} focusHeading={f} />,
  },
  {
    title: 'primer.screens.trump.title',
    render: (f) => <TrickScreen config={TRUMP} focusHeading={f} />,
  },
  { title: 'primer.screens.meld.title', render: (f) => <MeldScreen focusHeading={f} /> },
];

/** Number of lesson screens (the finish screen comes after them). */
export const PRIMER_STEPS = SCREENS.length;

/** Reads ?next= inside its own Suspense boundary so the rest of the primer prerenders. */
function NextParam({ onChange }: { onChange: (value: string | null) => void }) {
  const value = useSearchParams().get('next');
  useEffect(() => onChange(value), [value, onChange]);
  return null;
}

/** Widgets that use the arrow keys themselves (e.g. a hand of cards). */
const ARROW_WIDGETS = ['toolbar', 'listbox', 'slider', 'tablist', 'radiogroup', 'menu', 'menubar']
  .map((role) => `[role="${role}"]`)
  .join(',');

/** True when ←/→ belong to whatever has focus rather than to the primer. */
function ownsArrowKeys(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  // A dialog or sheet (settings, feedback…) open on top of the primer.
  if (el.closest('dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"]')) return true;
  return Boolean(el.closest(ARROW_WIDGETS));
}

export function Primer() {
  const router = useRouter();
  const reduced = useReducedMotionPref();
  const [nextParam, setNextParam] = useState<string | null>(null);
  const [nav, setNav] = useState({ step: 0, dir: 1, moved: false });
  const { step, dir, moved } = nav;
  const done = step === PRIMER_STEPS;
  const target = safeNextPath(nextParam);

  const go = (to: number) => {
    if (to < 0 || to > PRIMER_STEPS || to === step) return;
    setNav({ step: to, dir: to > step ? 1 : -1, moved: true });
    const title = to === PRIMER_STEPS ? 'primer.screens.done.title' : SCREENS[to]?.title;
    if (title) {
      announce(
        t('primer.stepAnnounce', {
          current: Math.min(to + 1, PRIMER_STEPS),
          total: PRIMER_STEPS,
          title: t(title),
        }),
      );
    }
  };

  const finish = () => {
    useSettings.getState().setPrimerSeen(true);
    router.push(target);
  };

  useEffect(() => {
    if (done) useSettings.getState().setPrimerSeen(true);
  }, [done]);

  const onArrow = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (ownsArrowKeys(e.target)) return;
    e.preventDefault();
    go(step + (e.key === 'ArrowRight' ? 1 : -1));
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onArrow(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const variants = {
    enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * 36 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * -36 }),
  };

  const screen = done ? <DoneScreen focusHeading={moved} /> : SCREENS[step]?.render(moved);

  return (
    <section className="felt-deep relative min-h-full overflow-hidden" data-testid="primer">
      <Suspense fallback={null}>
        <NextParam onChange={setNextParam} />
      </Suspense>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(245_215_122/0.12),transparent)]"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col px-4 pt-5 pb-10 sm:px-6 sm:pt-8">
        <div className="flex items-start justify-between gap-3">
          <div className="shrink-0 whitespace-nowrap">
            <h1 className="text-gold-300 text-xs font-bold tracking-[0.2em] uppercase">
              {t('primer.kicker')}
            </h1>
            <p className="text-mist tabular mt-1 text-sm font-semibold" aria-hidden="true">
              {t('primer.stepOf', {
                current: Math.min(step + 1, PRIMER_STEPS),
                total: PRIMER_STEPS,
              })}
            </p>
          </div>
          {!done && (
            <button
              type="button"
              onClick={finish}
              className="border-gold-300/50 bg-felt-950/40 text-gold-200 hover:border-gold-300 hover:bg-gold-300/10 inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-center text-sm leading-tight font-bold underline-offset-4 transition hover:underline"
            >
              {t('primer.skip')}
            </button>
          )}
        </div>

        <ProgressBar
          className="mt-4"
          current={Math.min(step + 1, PRIMER_STEPS)}
          total={PRIMER_STEPS}
          complete={done}
        />

        <div className="mt-6">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {screen}
            </motion.div>
          </AnimatePresence>
        </div>

        <nav
          aria-label={t('primer.navLabel')}
          className="border-gold-300/15 mt-6 flex items-center justify-between gap-3 border-t pt-5"
        >
          <button
            type="button"
            onClick={() => go(step - 1)}
            aria-disabled={step === 0 || undefined}
            className={secondaryButton}
          >
            <span aria-hidden="true">←</span>
            {t('primer.back')}
          </button>
          <button
            type="button"
            onClick={done ? finish : () => go(step + 1)}
            className={done ? finishButton : primaryButton}
            data-testid="primer-next"
          >
            {done
              ? target === DEFAULT_NEXT
                ? t('primer.finishGames')
                : t('primer.finish')
              : t('primer.next')}
            <span aria-hidden="true">→</span>
          </button>
        </nav>
        <p className="text-mist mt-3 hidden text-center text-xs sm:block">{t('primer.keysHint')}</p>
      </div>
    </section>
  );
}
