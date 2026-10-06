'use client';
/**
 * Upvote toggle (one vote per browser, see docs/DECISIONS.md D-10). Updates
 * optimistically, then settles on the server's answer — or rolls back and
 * explains what went wrong. The owner keeps the numbers; this component only
 * reports changes through `onVoteChange`.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { cn } from '@/components/ui/cn';
import { toast } from '@/components/ui/Toast';
import { toggleVote, type VoteResult } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { playSound } from '@/lib/sound';
import { useHydrated } from '@/store/hydrate';
import { plural } from './format';
import { UpvoteIcon } from './icons';
import { ensureVoterToken } from './voter';

export interface UpvoteButtonProps {
  postId: number;
  /** Post title, used in the accessible name and announcements. */
  title: string;
  upvotes: number;
  /** Whether this browser has voted (unknown = treated as not voted). */
  hasVoted?: boolean;
  onVoteChange: (postId: number, next: VoteResult) => void;
  /** `stub` = tall ticket-stub column (cards), `inline` = compact pill (post page). */
  layout?: 'stub' | 'inline';
  className?: string;
}

export function upvoteCountLabel(count: number): string {
  return plural(count, 'community.upvote.countOne', 'community.upvote.countMany');
}

export function UpvoteButton({
  postId,
  title,
  upvotes,
  hasVoted,
  onVoteChange,
  layout = 'stub',
  className,
}: UpvoteButtonProps) {
  const hydrated = useHydrated();
  const reduce = useReducedMotionPref();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  /** Which way the count last moved, so the digits roll in the right direction. */
  const [dir, setDir] = useState<1 | -1>(1);
  const voted = hasVoted === true;

  const onClick = async () => {
    // The voter token lives in a persisted store: only touch it once hydrated.
    if (!hydrated || pendingRef.current) return;
    const previous: VoteResult = { upvotes, hasVoted: voted };
    const optimistic: VoteResult = {
      upvotes: Math.max(0, upvotes + (voted ? -1 : 1)),
      hasVoted: !voted,
    };
    setDir(voted ? -1 : 1);
    pendingRef.current = true;
    setPending(true);
    onVoteChange(postId, optimistic);
    if (!voted) playSound('chip');

    const voterToken = ensureVoterToken();
    const res = await toggleVote(postId, voterToken);
    pendingRef.current = false;
    setPending(false);

    if (res.ok) {
      onVoteChange(postId, res.data);
      const count = upvoteCountLabel(res.data.upvotes);
      announce(
        res.data.hasVoted
          ? t('community.upvote.added', { title, count })
          : t('community.upvote.removed', { title, count }),
      );
      return;
    }
    onVoteChange(postId, previous);
    playSound('error');
    toast({ message: t('community.upvote.failed', { error: res.error }), tone: 'error' });
  };

  const stub = layout === 'stub';
  const iconSize = stub ? 22 : 18;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!hydrated}
      aria-pressed={voted}
      aria-busy={pending || undefined}
      aria-label={`${t('community.upvote.label', { title })} — ${upvoteCountLabel(upvotes)}`}
      data-testid={`upvote-${postId}`}
      data-voted={voted}
      data-count={upvotes}
      className={cn(
        'group/vote ease-snap relative inline-flex shrink-0 items-center justify-center font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.96] disabled:cursor-wait disabled:opacity-60',
        stub
          ? 'min-h-[4.75rem] w-14 flex-col gap-0.5 rounded-xl border sm:w-16'
          : 'min-h-11 gap-2 rounded-full border px-4',
        voted
          ? 'border-gold-200 text-ink bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))] shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_6px_18px_-8px_rgb(245_215_122/0.85)]'
          : 'border-gold-300/45 bg-felt-950/50 text-gold-200 hover:border-gold-300 hover:bg-gold-300/10 hover:text-gold-100',
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        className="inline-flex"
        initial={false}
        animate={voted && !reduce ? { y: [0, -4, 0], scale: [1, 1.18, 1] } : { y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.32 }}
      >
        <UpvoteIcon
          size={iconSize}
          className={cn(
            'transition-transform duration-150',
            !voted && 'group-hover/vote:-translate-y-0.5',
          )}
        />
      </motion.span>
      <span
        aria-hidden="true"
        className={cn(
          'tabular relative inline-flex items-center overflow-hidden leading-none',
          stub ? 'h-5 text-base' : 'h-5 text-sm',
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={upvotes}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: dir * 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: dir * -14 }}
            transition={{ duration: reduce ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block"
          >
            {upvotes.toLocaleString('en-US')}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}
