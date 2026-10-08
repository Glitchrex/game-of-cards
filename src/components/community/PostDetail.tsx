'use client';
/**
 * Single post view (/community/[id]): full post, upvote, status, comments and
 * the add-comment form. Renders the server-provided post straight away, then
 * refreshes once the stores hydrate so `hasVoted` reflects this browser.
 */
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { AlertIcon } from '@/components/ui/icons';
import { useReducedMotionPref } from '@/lib/motion';
import { getPost, type Comment, type Post, type VoteResult } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { useHydrated } from '@/store/hydrate';
import { CommentForm } from './CommentForm';
import { plural } from './format';
import { ArrowLeftIcon, CommentIcon } from './icons';
import { PostStatusBadge, PostTypeBadge } from './PostBadges';
import { PostGone } from './PostGone';
import { commentCountLabel } from './PostCard';
import { RelativeTime } from './RelativeTime';
import { UpvoteButton } from './UpvoteButton';
import { currentVoterToken } from './voter';

export interface PostWithComments {
  post: Post;
  comments: Comment[];
}

export interface PostDetailProps {
  postId: number;
  /** Server-rendered data; when absent the post is fetched in the browser. */
  initial?: PostWithComments | null;
}

type LoadState =
  | { kind: 'ready'; data: PostWithComments }
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'error'; message: string };

const COMMENTS_HEADING_ID = 'comments-heading';
const COMMENT_FORM_HEADING_ID = 'comment-form-heading';

export function PostDetail({ postId, initial }: PostDetailProps) {
  const hydrated = useHydrated();
  const reduce = useReducedMotionPref();
  const [state, setState] = useState<LoadState>(() =>
    initial ? { kind: 'ready', data: initial } : { kind: 'loading' },
  );
  /** Soft error from the background refresh (the server copy stays on screen). */
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [newCommentId, setNewCommentId] = useState<number | null>(null);
  const scrollToComment = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const ctrl = new AbortController();
    const voter = currentVoterToken();
    void getPost(postId, voter, { signal: ctrl.signal }).then((res) => {
      if (ctrl.signal.aborted) return;
      if (res.ok) {
        setState({ kind: 'ready', data: res.data });
        setRefreshError(null);
      } else if (res.status === 404) {
        setState({ kind: 'gone' });
      } else {
        setState((s) => (s.kind === 'ready' ? s : { kind: 'error', message: res.error }));
        setRefreshError(res.error);
      }
    });
    return () => ctrl.abort();
  }, [hydrated, postId, reloads]);

  useEffect(() => {
    const id = scrollToComment.current;
    if (id === null) return;
    const el = document.getElementById(`comment-${id}`);
    if (!el) return;
    scrollToComment.current = null;
    el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  });

  const onVoteChange = useCallback((id: number, next: VoteResult) => {
    setState((s) =>
      s.kind === 'ready' && s.data.post.id === id
        ? { kind: 'ready', data: { ...s.data, post: { ...s.data.post, ...next } } }
        : s,
    );
  }, []);

  const onCommentAdded = (comment: Comment) => {
    setNewCommentId(comment.id);
    scrollToComment.current = comment.id;
    setState((s) => {
      if (s.kind !== 'ready') return s;
      if (s.data.comments.some((c) => c.id === comment.id)) return s;
      return {
        kind: 'ready',
        data: {
          post: { ...s.data.post, commentCount: s.data.post.commentCount + 1 },
          comments: [...s.data.comments, comment],
        },
      };
    });
  };

  const retry = () => {
    setState({ kind: 'loading' });
    setReloads((n) => n + 1);
  };

  return (
    <div className="relative mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <Link
        href="/community"
        className="text-gold-200 hover:text-gold-100 -ml-1 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold"
        data-testid="back-to-board"
      >
        <ArrowLeftIcon size={18} />
        {t('community.detail.back')}
      </Link>

      {state.kind === 'loading' ? <DetailSkeleton /> : null}
      {state.kind === 'gone' ? <PostGone className="mt-6" /> : null}
      {state.kind === 'error' ? <LoadError message={state.message} onRetry={retry} /> : null}
      {state.kind === 'ready' ? (
        <>
          <PostArticle post={state.data.post} onVoteChange={onVoteChange} />
          {refreshError ? (
            <p className="text-mist mt-3 flex items-start gap-2 text-sm" role="status">
              <AlertIcon size={16} className="text-velvet-300 mt-0.5 shrink-0" />
              {t('community.detail.refreshFailed', { error: refreshError })}
            </p>
          ) : null}

          <section
            id="comments"
            aria-labelledby={COMMENTS_HEADING_ID}
            className="mt-10 scroll-mt-24"
          >
            <div className="flex items-baseline gap-3">
              <h2
                id={COMMENTS_HEADING_ID}
                className="font-display text-gold-100 text-2xl leading-tight font-bold sm:text-3xl"
              >
                {t('community.detail.commentsHeading')}
              </h2>
              <span className="text-mist tabular text-sm font-semibold">
                {plural(
                  state.data.comments.length,
                  'community.card.commentsOne',
                  'community.card.commentsMany',
                )}
              </span>
            </div>
            <CommentList comments={state.data.comments} highlightId={newCommentId} />

            <div className="panel mt-8 p-5 sm:p-6">
              <h3
                id={COMMENT_FORM_HEADING_ID}
                className="font-display text-gold-100 text-xl leading-tight font-bold sm:text-2xl"
              >
                {t('community.commentForm.heading')}
              </h3>
              <div className="mt-4">
                <CommentForm
                  postId={state.data.post.id}
                  onAdded={onCommentAdded}
                  labelledBy={COMMENT_FORM_HEADING_ID}
                />
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function PostArticle({
  post,
  onVoteChange,
}: {
  post: Post;
  onVoteChange: (postId: number, next: VoteResult) => void;
}) {
  return (
    <article
      className="panel relative mt-4 overflow-hidden"
      aria-labelledby="post-heading"
      data-testid="post-detail"
      data-status={post.status}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-gold-300),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_60%_at_50%_0%,rgb(245_215_122/0.08),transparent_60%)]"
      />
      <div className="relative px-5 pt-5 pb-4 sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-center gap-2">
          <PostTypeBadge type={post.type} />
          <PostStatusBadge status={post.status} />
          <span
            aria-hidden="true"
            className="text-gold-300/60 font-display ml-auto text-xs font-bold tracking-[0.2em] uppercase"
          >
            No.{post.id}
          </span>
        </div>
        <h1
          id="post-heading"
          className="font-display text-foil mt-4 text-[1.875rem] leading-[1.1] font-black tracking-[-0.015em] text-balance break-words sm:text-[2.75rem]"
        >
          {post.title}
        </h1>
        <p className="text-mist mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-medium">
          <span className="text-cream">
            {post.authorName
              ? t('community.card.by', { name: post.authorName })
              : t('community.card.anonymous')}
          </span>
          <span aria-hidden="true" className="text-gold-300/50">
            ✦
          </span>
          <RelativeTime iso={post.createdAt} />
        </p>
      </div>

      <div
        className="text-cream relative px-5 pb-6 text-base leading-relaxed break-words whitespace-pre-line sm:px-8 sm:text-[1.0625rem]"
        data-testid="post-body"
      >
        {post.body}
      </div>

      <div className="border-gold-300/20 bg-felt-950/30 relative flex flex-wrap items-center gap-3 border-t border-dashed px-5 py-4 sm:px-8">
        <UpvoteButton
          postId={post.id}
          title={post.title}
          upvotes={post.upvotes}
          hasVoted={post.hasVoted}
          onVoteChange={onVoteChange}
          layout="inline"
        />
        <a
          href="#comments"
          className="text-gold-200 hover:text-gold-100 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold underline-offset-4 hover:underline"
        >
          <CommentIcon size={18} />
          {commentCountLabel(post.commentCount)}
        </a>
      </div>
    </article>
  );
}

function initialOf(name: string | null): string {
  const ch = name?.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

function CommentList({
  comments,
  highlightId,
}: {
  comments: Comment[];
  highlightId: number | null;
}) {
  return (
    <div className="mt-4" data-testid="comment-list">
      {comments.length === 0 ? (
        <p className="border-gold-300/20 text-mist rounded-2xl border border-dashed px-5 py-6 text-center">
          {t('community.detail.noComments')}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {comments.map((c) => (
            <li
              key={c.id}
              id={`comment-${c.id}`}
              data-testid={`comment-${c.id}`}
              className={cn(
                'bg-felt-800/70 flex gap-3 rounded-2xl border px-4 py-3.5 transition-[border-color,box-shadow] duration-300 sm:px-5',
                c.id === highlightId
                  ? 'border-gold-300/70 shadow-[0_0_24px_-8px_rgb(245_215_122/0.6)]'
                  : 'border-gold-300/15',
              )}
            >
              <span
                aria-hidden="true"
                className="border-gold-300/40 font-display text-gold-200 bg-felt-950/60 inline-flex size-10 shrink-0 items-center justify-center rounded-full border text-lg font-bold"
              >
                {initialOf(c.authorName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="text-cream font-semibold">
                    {c.authorName ?? t('community.card.anonymous')}
                  </span>
                  <RelativeTime iso={c.createdAt} className="text-mist text-[0.8125rem]" />
                </p>
                <p className="text-cream/95 mt-1 text-[0.9375rem] leading-relaxed break-words whitespace-pre-line">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-4" data-testid="post-detail-loading">
      <p role="status" className="sr-only">
        {t('common.loading')}
      </p>
      <div aria-hidden="true" className="panel animate-pulse space-y-4 p-6 sm:p-8">
        <div className="flex gap-2">
          <div className="bg-felt-600/70 h-6 w-28 rounded-full" />
          <div className="bg-felt-600/50 h-6 w-20 rounded-full" />
        </div>
        <div className="bg-felt-600/70 h-9 w-4/5 rounded-md" />
        <div className="bg-felt-600/40 h-4 w-1/3 rounded-md" />
        <div className="space-y-2 pt-2">
          <div className="bg-felt-600/40 h-4 w-full rounded-md" />
          <div className="bg-felt-600/40 h-4 w-11/12 rounded-md" />
          <div className="bg-felt-600/40 h-4 w-2/3 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="border-velvet-400/50 bg-velvet-700/35 mt-6 flex flex-col items-start gap-3 rounded-2xl border p-5"
    >
      <p className="text-cream flex items-start gap-2 font-semibold">
        <AlertIcon size={20} className="text-velvet-300 mt-0.5 shrink-0" />
        <span>{message}</span>
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t('community.list.retry')}
      </Button>
    </div>
  );
}
