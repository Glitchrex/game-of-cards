/** Small presentational pieces shared by the lesson, quiz and example players. */
import { type ReactNode, type Ref } from 'react';
import { cn } from '@/components/ui/cn';
import { CheckIcon, CloseIcon, SparkleIcon } from '@/components/ui/icons';

/** The felt "stage" a card scene sits on: brass rim, spotlight and marquee bulbs. */
export function TableStage({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  /** Accessible name; when set the stage is a labelled region. */
  label?: string;
}) {
  return (
    <div
      role={label ? 'region' : undefined}
      aria-label={label}
      className={cn(
        'felt border-gold-300/30 relative flex flex-col items-center justify-center overflow-hidden rounded-[22px] border px-3 pt-8 pb-5 shadow-[inset_0_0_44px_rgb(0_0_0/0.5),0_18px_40px_-24px_rgb(0_0_0/0.9)] sm:px-6',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-6 top-0 h-3.5 opacity-60"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(245_215_122/0.14),transparent)]"
      />
      <div className="relative flex w-full flex-1 flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/** Speech-bubble tip under a lesson step (a `note`, not a landmark). */
export function TipBubble({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="note"
      className="border-gold-300/45 bg-felt-950/60 relative mt-5 rounded-2xl border px-4 py-3 shadow-[0_10px_24px_-16px_rgb(0_0_0/0.9)]"
    >
      <span
        aria-hidden="true"
        className="border-gold-300/45 bg-felt-950 absolute -top-[7px] left-7 size-3 rotate-45 border-t border-l"
      />
      <p className="flex items-start gap-2.5 text-[0.9375rem] leading-relaxed">
        <SparkleIcon size={18} className="text-gold-300 mt-1 shrink-0" />
        <span>
          <strong className="text-gold-200 font-bold">{label}: </strong>
          <span className="text-cream">{children}</span>
        </span>
      </p>
    </div>
  );
}

export type FeedbackTone = 'right' | 'wrong';

/** Correct/incorrect feedback: icon + title + text, never colour alone. */
export function FeedbackNote({
  tone,
  title,
  children,
  className,
  ref,
  testId,
}: {
  tone: FeedbackTone;
  title: string;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  testId?: string;
}) {
  const right = tone === 'right';
  return (
    <div
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      data-testid={testId}
      data-tone={tone}
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3.5 outline-none',
        right ? 'border-gold-300/60 bg-gold-300/10' : 'border-velvet-400/60 bg-velvet-700/25',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full',
          right ? 'bg-gold-300 text-ink' : 'bg-velvet-500 text-cream',
        )}
      >
        {right ? <CheckIcon size={16} /> : <CloseIcon size={16} />}
      </span>
      <div className="min-w-0 text-[0.9375rem] leading-relaxed">
        <p className={cn('font-bold', right ? 'text-gold-200' : 'text-velvet-300')}>{title}</p>
        <div className="text-cream mt-0.5">{children}</div>
      </div>
    </div>
  );
}

/** Small uppercase kicker used above headings. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-gold-300 inline-flex items-center gap-2 text-xs font-bold tracking-[0.22em] uppercase',
        className,
      )}
    >
      <span aria-hidden="true" className="animate-bulb bg-gold-300 size-1.5 rounded-full" />
      {children}
    </p>
  );
}
