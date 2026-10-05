'use client';
/**
 * Floating "Feedback" pill (bottom-right on every page except /admin) that
 * opens a sheet with the feedback form. Other components can open it with
 * `openFeedback()` (optionally pre-selecting a type). The draft survives an
 * accidental close.
 *
 * On phones the pill hides on full-screen game tables (/games/<slug>/play and
 * /try) so it never covers the action bar; feedback stays reachable from the
 * header menu there.
 */
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { create } from 'zustand';
import { cn } from '@/components/ui/cn';
import { MegaphoneIcon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { t } from '@/lib/i18n';
import {
  emptyFeedbackDraft,
  FeedbackForm,
  type FeedbackDraft,
  type FeedbackType,
} from './FeedbackForm';

interface FeedbackUiState {
  open: boolean;
  draft: FeedbackDraft;
}

const useFeedbackUi = create<FeedbackUiState>(() => ({
  open: false,
  draft: emptyFeedbackDraft(),
}));

/** Open the feedback sheet, optionally pre-selecting the post type. */
export function openFeedback(type?: FeedbackType): void {
  useFeedbackUi.setState((s) => ({ open: true, draft: type ? { ...s.draft, type } : s.draft }));
}

export function closeFeedback(): void {
  useFeedbackUi.setState({ open: false });
}

/** Close the sheet and discard any unsent draft. */
export function resetFeedback(): void {
  useFeedbackUi.setState({ open: false, draft: emptyFeedbackDraft() });
}

const IMMERSIVE = /^\/games\/[^/]+\/(play|try)\/?$/;

export function FeedbackButton() {
  const pathname = usePathname() ?? '/';
  const open = useFeedbackUi((s) => s.open);
  const draft = useFeedbackUi((s) => s.draft);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  if (pathname.startsWith('/admin')) return null;
  const immersive = IMMERSIVE.test(pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => openFeedback()}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="feedback-button"
        className={cn(
          'group border-gold-300/70 text-cream ease-snap fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 inline-flex h-11 items-center gap-1.5 rounded-full border bg-[linear-gradient(180deg,var(--color-velvet-500),var(--color-velvet-700))] pr-4 pl-3 text-[0.8125rem] font-bold tracking-wide shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_24px_-10px_rgb(0_0_0/0.9),0_0_0_4px_rgb(3_17_11/0.35)] transition-[transform,box-shadow,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 sm:right-5 sm:bottom-5 sm:h-12 sm:gap-2 sm:pr-5 sm:pl-4 sm:text-sm',
          immersive && 'max-sm:hidden',
        )}
      >
        <MegaphoneIcon
          size={18}
          className="text-gold-200 transition-transform duration-200 group-hover:-rotate-12"
        />
        {t('nav.feedback')}
      </button>
      <Sheet
        open={open}
        onClose={closeFeedback}
        eyebrow={t('contact.feedback.eyebrow')}
        title={t('contact.feedback.title')}
        description={t('contact.feedback.intro')}
        initialFocusRef={firstFieldRef}
      >
        <FeedbackForm
          draft={draft}
          onDraftChange={(d) => useFeedbackUi.setState({ draft: d })}
          onPosted={() => useFeedbackUi.setState({ draft: emptyFeedbackDraft() })}
          onDone={closeFeedback}
          firstFieldRef={firstFieldRef}
        />
      </Sheet>
    </>
  );
}
