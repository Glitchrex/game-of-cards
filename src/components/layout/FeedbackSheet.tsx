'use client';
/**
 * The feedback sheet (sheet + form). Loaded on demand by <FeedbackButton/> the first time
 * feedback is opened, so the form, its validation and the sheet stay out of every page's
 * first-load JS.
 */
import { useRef } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { t } from '@/lib/i18n';
import { type FeedbackDraft } from './feedback-draft';
import { FeedbackForm } from './FeedbackForm';

export interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
  draft: FeedbackDraft;
  onDraftChange: (draft: FeedbackDraft) => void;
  /** The draft was posted (clear it). */
  onPosted: () => void;
}

export function FeedbackSheet({
  open,
  onClose,
  draft,
  onDraftChange,
  onPosted,
}: FeedbackSheetProps) {
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={t('contact.feedback.eyebrow')}
      title={t('contact.feedback.title')}
      description={t('contact.feedback.intro')}
      initialFocusRef={firstFieldRef}
    >
      <FeedbackForm
        draft={draft}
        onDraftChange={onDraftChange}
        onPosted={onPosted}
        onDone={onClose}
        firstFieldRef={firstFieldRef}
      />
    </Sheet>
  );
}
