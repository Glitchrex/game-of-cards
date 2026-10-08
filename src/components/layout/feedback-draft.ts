/**
 * The feedback draft (kept in the FeedbackButton store so it survives an accidental close).
 * Separate from the form so the always-loaded feedback button doesn't pull the form in.
 */
export type FeedbackType = 'feature' | 'bug' | 'game' | 'general';
export const FEEDBACK_TYPES: readonly FeedbackType[] = ['feature', 'bug', 'game', 'general'];

export interface FeedbackDraft {
  type: FeedbackType;
  title: string;
  body: string;
  name: string;
  email: string;
  /** Honeypot — real people never see or fill this. */
  website: string;
}

export const emptyFeedbackDraft = (type: FeedbackType = 'feature'): FeedbackDraft => ({
  type,
  title: '',
  body: '',
  name: '',
  email: '',
  website: '',
});
