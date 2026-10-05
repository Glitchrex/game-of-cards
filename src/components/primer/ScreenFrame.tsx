'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export type FeedbackTone = 'info' | 'right' | 'wrong' | 'done';
export interface Feedback {
  tone: FeedbackTone;
  text: string;
}

export interface ScreenFrameProps {
  title: string;
  body: ReactNode;
  /** What to do on this screen ("Tap the deck…"). */
  action?: string;
  feedback?: Feedback | null;
  /** The interactive table. */
  children: ReactNode;
  /** Controls under the table (toggles, "try again"). */
  extra?: ReactNode;
  /** Move focus to the heading on mount when focus would otherwise be lost. */
  focusHeading?: boolean;
  /** Smaller stage (e.g. the finish screen). */
  stageClassName?: string;
}

function TapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true" focusable="false">
      <path
        d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0v1m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5.2-3l-2-3.5a1.5 1.5 0 0 1 2.6-1.5L9 15"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ToneIcon({ tone }: { tone: FeedbackTone }) {
  if (tone === 'wrong') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 size-5 shrink-0"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="10" fill="currentColor" opacity={0.18} />
        <path
          d="M8.5 8.5l7 7m0-7l-7 7"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (tone === 'info') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 size-5 shrink-0"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="10" fill="currentColor" opacity={0.18} />
        <path
          d="M12 11v6M12 7.5v.5"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 size-5 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity={0.2} />
      <path
        d="M7.5 12.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TONE_CLASS: Record<FeedbackTone, string> = {
  info: 'text-cream',
  right: 'text-gold-200',
  done: 'text-gold-200',
  wrong: 'text-velvet-300',
};

/** Title, friendly copy, the felt "stage" with the interaction, and live feedback. */
export function ScreenFrame({
  title,
  body,
  action,
  feedback,
  children,
  extra,
  focusHeading = false,
  stageClassName,
}: ScreenFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!focusHeading) return;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [focusHeading]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-foil text-[28px] leading-tight font-bold tracking-[-0.01em] sm:text-4xl"
        >
          {title}
        </h2>
        <div className="text-cream/90 mt-2 max-w-prose text-base leading-relaxed">{body}</div>
      </header>

      <div
        className={`felt border-gold-300/30 relative flex flex-col overflow-hidden rounded-[22px] border px-3 pt-6 pb-5 shadow-[inset_0_0_40px_rgb(0_0_0/0.45),0_18px_40px_-24px_rgb(0_0_0/0.9)] sm:px-6 ${
          stageClassName ?? 'min-h-[264px]'
        }`}
      >
        <span
          aria-hidden="true"
          className="marquee-bulbs animate-bulb absolute inset-x-6 top-0 h-3.5 opacity-60"
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">{children}</div>
      </div>

      {action && (
        <p className="text-gold-200 flex items-center gap-2 text-sm font-semibold">
          <TapIcon />
          {action}
        </p>
      )}
      {extra}
      <p
        role="status"
        aria-live="polite"
        className={`flex min-h-[3rem] items-start gap-2 text-base leading-snug font-medium ${
          feedback ? TONE_CLASS[feedback.tone] : ''
        }`}
      >
        {feedback && (
          <>
            <ToneIcon tone={feedback.tone} />
            <span>{feedback.text}</span>
          </>
        )}
      </p>
    </div>
  );
}
