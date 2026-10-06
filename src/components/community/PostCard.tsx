'use client';
/**
 * One post on the board, styled as a cinema ticket: the tear-off stub holds
 * the upvote button, the main part has badges, title, excerpt and meta.
 * The title link is stretched over the whole card, so anywhere opens the post.
 */
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { type Post, type VoteResult } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { excerpt, plural } from './format';
import { CommentIcon } from './icons';
import { PostStatusBadge, PostTypeBadge } from './PostBadges';
import { RelativeTime } from './RelativeTime';
import { UpvoteButton } from './UpvoteButton';

export interface PostCardProps {
  post: Post;
  onVoteChange: (postId: number, next: VoteResult) => void;
  /** Glow + "Just posted" ribbon for the post this browser just created. */
  highlight?: boolean;
  /** Heading level of the title inside the surrounding outline (default 3). */
  headingLevel?: 2 | 3;
  className?: string;
}

export function commentCountLabel(count: number): string {
  return count === 0
    ? t('community.card.commentsNone')
    : plural(count, 'community.card.commentsOne', 'community.card.commentsMany');
}

export function postTitleId(postId: number): string {
  return `post-title-${postId}`;
}

export function PostCard({
  post,
  onVoteChange,
  highlight = false,
  headingLevel = 3,
  className,
}: PostCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const href = `/community/${post.id}`;
  const comments = commentCountLabel(post.commentCount);
  return (
    <article
      data-testid={`post-card-${post.id}`}
      data-post-type={post.type}
      data-status={post.status}
      aria-labelledby={postTitleId(post.id)}
      className={cn(
        'group/card bg-felt-800/80 relative flex overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,rgb(255_255_255/0.055),rgb(0_0_0/0.14))] transition-[border-color,box-shadow] duration-200',
        highlight
          ? 'border-gold-300/80 shadow-[0_0_0_1px_var(--color-gold-300),0_0_28px_-6px_rgb(245_215_122/0.55)]'
          : 'border-gold-300/25 focus-within:border-gold-300/60 hover:border-gold-300/55 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_14px_30px_-18px_rgb(0_0_0/0.85)]',
        className,
      )}
    >
      {/* Ticket stub with the upvote button. */}
      <div className="border-gold-300/30 bg-felt-950/35 relative z-10 flex w-[4.5rem] shrink-0 flex-col items-center border-r border-dashed px-2 py-3.5 sm:w-[5.25rem] sm:py-4">
        <span
          aria-hidden="true"
          className="border-gold-300/25 bg-felt-900 absolute -top-2.5 -right-2.5 size-5 rounded-full border"
        />
        <span
          aria-hidden="true"
          className="border-gold-300/25 bg-felt-900 absolute -right-2.5 -bottom-2.5 size-5 rounded-full border"
        />
        <UpvoteButton
          postId={post.id}
          title={post.title}
          upvotes={post.upvotes}
          hasVoted={post.hasVoted}
          onVoteChange={onVoteChange}
        />
        <span
          aria-hidden="true"
          className="text-gold-300/60 font-display mt-2 text-[0.625rem] font-bold tracking-[0.2em] uppercase"
        >
          No.{post.id}
        </span>
      </div>

      <div className="min-w-0 flex-1 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <PostTypeBadge type={post.type} size="sm" />
          <PostStatusBadge status={post.status} size="sm" />
          {highlight ? (
            <Badge tone="velvet" size="sm" pulse>
              {t('community.card.justPosted')}
            </Badge>
          ) : null}
        </div>

        <Heading className="text-cream mt-2 text-[1.0625rem] leading-snug font-bold text-balance break-words sm:text-lg">
          <Link
            id={postTitleId(post.id)}
            href={href}
            className="group-hover/card:text-gold-100 rounded-sm transition-colors after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4"
          >
            {post.title}
          </Link>
        </Heading>

        <p className="text-mist mt-1.5 line-clamp-3 text-[0.9375rem] leading-relaxed break-words">
          {excerpt(post.body, 220)}
        </p>

        <div className="text-mist mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] font-medium">
          <span className="text-cream/90 max-w-full truncate">
            {post.authorName
              ? t('community.card.by', { name: post.authorName })
              : t('community.card.anonymous')}
          </span>
          <span aria-hidden="true" className="text-gold-300/50">
            ✦
          </span>
          <RelativeTime iso={post.createdAt} />
          <Link
            href={`${href}#comments`}
            aria-label={t('community.card.commentsLink', { count: comments, title: post.title })}
            className="text-gold-200 hover:text-gold-100 relative z-10 -my-2 ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 font-semibold underline-offset-4 hover:underline"
          >
            <CommentIcon size={16} />
            <span>{comments}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
