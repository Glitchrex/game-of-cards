'use client';
/**
 * "How was this lesson?" — a one-rating-per-prompt star rating.
 *
 * Flow: tap a star → an optional comment box appears with "Send rating" and
 * "Skip comment, just send" → exactly ONE POST /api/ratings → thank-you. If the learner
 * picks stars and then leaves (closes the overlay, navigates away) without pressing
 * either button, the stars alone are sent once on unmount, so a tap is never lost.
 * A successful rating is remembered for the browser session (sessionStorage) and the
 * prompt doesn't appear again for that game + context — not even while that request is
 * still in flight (e.g. the result overlay is closed and reopened straight away).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { TextArea } from '@/components/ui/Field';
import { useIsClient } from '@/components/ui/hooks';
import { AlertIcon, CheckIcon } from '@/components/ui/icons';
import { Stars } from '@/components/ui/Stars';
import { sendRating } from '@/lib/api-client';
import { t } from '@/lib/i18n';

export interface RatingPromptProps {
  gameSlug: string;
  context: 'lesson' | 'game';
  className?: string;
}

const COMMENT_MAX = 500;

type Phase = 'pick' | 'compose' | 'sending' | 'done' | 'error';

export function ratingStorageKey(gameSlug: string, context: RatingPromptProps['context']): string {
  return `goc:rated:${context}:${gameSlug}`;
}

/** Ratings being sent right now (by any prompt instance), keyed like sessionStorage. */
const inFlight = new Set<string>();

function wasRated(key: string): boolean {
  if (inFlight.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function remember(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Private mode / storage disabled: the prompt may simply show again next time.
  }
}

/** POST the rating once; remembers success even if the prompt has unmounted meanwhile. */
async function deliver(
  key: string,
  rating: Parameters<typeof sendRating>[0],
): ReturnType<typeof sendRating> {
  inFlight.add(key);
  const res = await sendRating(rating);
  if (res.ok) remember(key);
  inFlight.delete(key);
  return res;
}

export function RatingPrompt({ gameSlug, context, className }: RatingPromptProps) {
  const isClient = useIsClient();
  const key = ratingStorageKey(gameSlug, context);
  const [ratedBefore] = useState(() => typeof window !== 'undefined' && wasRated(key));
  const [stars, setStars] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const doneRef = useRef<HTMLParagraphElement>(null);
  // Mutable tracker shared with the unmount effect (same object for the whole life).
  const track = useRef({ stars: null as number | null, sent: false, alive: true });

  useEffect(() => {
    const tracked = track.current;
    tracked.alive = true;
    return () => {
      tracked.alive = false;
      if (tracked.stars !== null && !tracked.sent) {
        tracked.sent = true;
        void deliver(key, { gameSlug, stars: tracked.stars });
      }
    };
  }, [gameSlug, key]);

  useEffect(() => {
    if (phase === 'done') doneRef.current?.focus({ preventScroll: true });
  }, [phase]);

  if (!isClient || ratedBefore) return null;

  const pick = (n: number) => {
    setStars(n);
    track.current.stars = n;
    if (phase === 'pick') setPhase('compose');
  };

  const submit = async (withComment: boolean) => {
    const tracked = track.current;
    if (stars === null || tracked.sent) return;
    tracked.sent = true;
    setPhase('sending');
    setError(null);
    const text = comment.trim().slice(0, COMMENT_MAX);
    const res = await deliver(
      key,
      withComment && text ? { gameSlug, stars, comment: text } : { gameSlug, stars },
    );
    if (!tracked.alive) return;
    if (res.ok) {
      setPhase('done');
    } else {
      tracked.sent = false;
      setError(res.error || t('play.rating.failed'));
      setPhase('error');
    }
  };

  const sending = phase === 'sending';

  return (
    <section
      aria-labelledby={headingId}
      data-testid="rating-prompt"
      data-state={phase}
      className={cn(
        'border-gold-300/25 bg-felt-950/45 rounded-2xl border px-4 py-4 text-left sm:px-5',
        className,
      )}
    >
      <h3 id={headingId} className="font-display text-gold-100 text-lg leading-tight font-bold">
        {t('play.rating.title')}
      </h3>
      {phase === 'done' ? (
        <p
          ref={doneRef}
          tabIndex={-1}
          role="status"
          className="text-cream mt-2 flex items-start gap-2 text-[0.9375rem] leading-snug outline-none"
        >
          <span
            aria-hidden="true"
            className="bg-gold-300 text-ink mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full"
          >
            <CheckIcon size={14} />
          </span>
          <span>
            <span className="font-semibold">{t('play.rating.thanks', { stars: stars ?? 0 })}</span>{' '}
            <span className="text-mist">{t('play.rating.thanksHint')}</span>
          </span>
        </p>
      ) : (
        <>
          <p className="text-mist mt-0.5 text-sm">
            {context === 'lesson' ? t('play.rating.lessonHint') : t('play.rating.gameHint')}
          </p>
          <Stars
            value={stars}
            onChange={pick}
            label={t('play.rating.title')}
            labelledBy={headingId}
            disabled={sending}
            className="mt-2 -ml-1.5"
          />
          {phase !== 'pick' ? (
            <div className="mt-3 flex flex-col gap-3">
              <TextArea
                label={t('play.rating.commentLabel')}
                hint={t('play.rating.commentHint')}
                optional
                rows={2}
                maxLength={COMMENT_MAX}
                showCount
                value={comment}
                disabled={sending}
                onChange={(e) => setComment(e.target.value)}
              />
              {error ? (
                <p
                  role="alert"
                  className="text-velvet-300 flex items-start gap-1.5 text-sm font-medium"
                >
                  <AlertIcon size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  loading={sending}
                  loadingLabel={t('play.rating.sending')}
                  onClick={() => void submit(true)}
                  data-testid="rating-send"
                >
                  {t('play.rating.send')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={sending}
                  onClick={() => void submit(false)}
                  data-testid="rating-skip"
                >
                  {t('play.rating.skip')}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
