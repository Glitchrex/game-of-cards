'use client';
/**
 * The interactive part of /community: the "New post" form, sort tabs, type
 * filter chips and the list of posts (fetched with listPosts once the stores
 * have hydrated, so `hasVoted` can use this browser's voter token).
 */
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { AlertIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import {
  listPosts,
  POST_SORTS,
  POST_TYPES,
  type Post,
  type PostSort,
  type PostType,
  type VoteResult,
} from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { useHydrated } from '@/store/hydrate';
import { plural } from './format';
import { PencilIcon, TypeIcon } from './icons';
import { postTypeLabel } from './PostBadges';
import { PostCard } from './PostCard';
import { PostForm } from './PostForm';
import { currentVoterToken } from './voter';

type TypeFilter = PostType | 'all';

interface Loaded {
  key: string;
  posts: Post[];
}

interface Failure {
  key: string;
  message: string;
}

const FORM_HEADING_ID = 'new-post-heading';
const BOARD_HEADING_ID = 'board-heading';

export function CommunityBoard() {
  const hydrated = useHydrated();
  const reduce = useReducedMotionPref();
  const [sort, setSort] = useState<PostSort>('new');
  const [type, setType] = useState<TypeFilter>('all');
  const [reloads, setReloads] = useState(0);
  const requestKey = `${sort}|${type}|${reloads}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  /** Post to scroll into view after the next render (the one just created). */
  const scrollToId = useRef<number | null>(null);
  /** Announce the result count when a load was started by the user. */
  const announceResult = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    const ctrl = new AbortController();
    // Only read the token here — ensureVoterToken() runs on the first vote.
    const voter = currentVoterToken();
    void listPosts({ sort, type, voter }, { signal: ctrl.signal }).then((res) => {
      if (ctrl.signal.aborted) return;
      if (res.ok) {
        setLoaded({ key: requestKey, posts: res.data.posts });
        setFailure(null);
        if (announceResult.current) {
          announceResult.current = false;
          announce(
            plural(res.data.posts.length, 'community.list.countOne', 'community.list.countMany'),
          );
        }
      } else {
        setFailure({ key: requestKey, message: res.error });
      }
    });
    return () => ctrl.abort();
  }, [hydrated, sort, type, requestKey]);

  useEffect(() => {
    const id = scrollToId.current;
    if (id === null) return;
    const el = document.querySelector<HTMLElement>(`[data-testid="post-card-${id}"]`);
    if (!el) return;
    scrollToId.current = null;
    el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  });

  const onVoteChange = useCallback((postId: number, next: VoteResult) => {
    setLoaded((d) =>
      d ? { ...d, posts: d.posts.map((p) => (p.id === postId ? { ...p, ...next } : p)) } : d,
    );
  }, []);

  const onCreated = (post: Post) => {
    setHighlightId(post.id);
    scrollToId.current = post.id;
    setLoaded((d) => ({
      key: d?.key ?? requestKey,
      posts: [post, ...(d?.posts ?? []).filter((p) => p.id !== post.id)],
    }));
    // Show the new post at the top: newest first, and a filter that includes it.
    if (sort !== 'new') setSort('new');
    if (type !== 'all' && type !== post.type) setType('all');
    // The list had failed to load: show the new post now and fetch the rest again.
    if (failure?.key === requestKey) {
      setFailure(null);
      setReloads((n) => n + 1);
    }
  };

  const changeSort = (next: PostSort) => {
    if (next === sort) return;
    announceResult.current = true;
    setHighlightId(null);
    setSort(next);
  };

  const changeType = (next: TypeFilter) => {
    if (next === type) return;
    announceResult.current = true;
    setHighlightId(null);
    setType(next);
  };

  const retry = () => {
    setFailure(null);
    setReloads((n) => n + 1);
  };

  const focusForm = () => {
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  };

  const currentFailure = failure?.key === requestKey ? failure.message : null;
  const stale = loaded !== null && loaded.key !== requestKey && !currentFailure;
  const posts = loaded?.posts ?? [];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <section aria-labelledby={FORM_HEADING_ID} className="panel relative p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="border-gold-300/40 bg-felt-950/60 text-gold-200 inline-flex size-11 shrink-0 items-center justify-center rounded-xl border"
          >
            <PencilIcon size={20} />
          </span>
          <div>
            <h2
              id={FORM_HEADING_ID}
              className="font-display text-gold-100 text-2xl leading-tight font-bold"
            >
              {t('community.form.heading')}
            </h2>
            <p className="text-mist mt-1 text-sm leading-relaxed">{t('community.form.intro')}</p>
          </div>
        </div>
        <div className="mt-5">
          <PostForm onCreated={onCreated} titleRef={titleRef} labelledBy={FORM_HEADING_ID} />
        </div>
      </section>

      <section id="board" aria-labelledby={BOARD_HEADING_ID} className="min-w-0 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex items-baseline gap-3">
            <h2
              id={BOARD_HEADING_ID}
              className="font-display text-gold-100 text-2xl leading-tight font-bold sm:text-3xl"
            >
              {t('community.list.heading')}
            </h2>
            {loaded && !stale && !currentFailure ? (
              <span className="text-mist tabular text-sm font-semibold" data-testid="post-count">
                {plural(posts.length, 'community.list.countOne', 'community.list.countMany')}
              </span>
            ) : null}
          </div>
          <div
            role="group"
            aria-label={t('community.list.sortLabel')}
            className="border-gold-300/20 bg-felt-950/50 inline-flex rounded-xl border p-1"
          >
            {POST_SORTS.map((s) => {
              const selected = s === sort;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => changeSort(s)}
                  data-testid={`sort-${s}`}
                  className={cn(
                    'relative inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150',
                    selected ? 'text-ink' : 'text-mist hover:text-cream',
                  )}
                >
                  {selected ? (
                    <motion.span
                      layoutId="community-sort-indicator"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-lg bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))] shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_4px_14px_-6px_rgb(236_193_83/0.8)]"
                      transition={
                        reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
                      }
                    />
                  ) : null}
                  <span className="relative">{t(`community.list.sort.${s}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="group"
          aria-label={t('community.list.filterLabel')}
          className="mt-4 flex flex-wrap gap-2"
        >
          <Chip
            selected={type === 'all'}
            onSelectedChange={() => changeType('all')}
            data-testid="filter-all"
          >
            {t('community.list.all')}
          </Chip>
          {POST_TYPES.map((pt) => (
            <Chip
              key={pt}
              selected={type === pt}
              onSelectedChange={() => changeType(pt)}
              icon={<TypeIcon type={pt} size={16} />}
              data-testid={`filter-${pt}`}
            >
              {postTypeLabel(pt)}
            </Chip>
          ))}
        </div>

        <div
          className="relative mt-5"
          data-testid="post-list"
          aria-busy={!loaded || stale || undefined}
        >
          {currentFailure ? (
            <LoadError message={currentFailure} onRetry={retry} />
          ) : !loaded ? (
            <ListSkeleton />
          ) : posts.length === 0 ? (
            <EmptyState
              type={type}
              onWrite={focusForm}
              onShowAll={() => changeType('all')}
              stale={stale}
            />
          ) : (
            <>
              {stale ? (
                <p role="status" className="sr-only">
                  {t('community.list.updating')}
                </p>
              ) : null}
              <ol
                className={cn(
                  'flex flex-col gap-3 transition-opacity duration-200 sm:gap-4',
                  stale && 'opacity-60',
                )}
              >
                {posts.map((post, i) => (
                  <motion.li
                    key={post.id}
                    layout={reduce ? false : 'position'}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduce ? 0.12 : 0.32,
                      delay: reduce ? 0 : Math.min(i, 8) * 0.04,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <PostCard
                      post={post}
                      onVoteChange={onVoteChange}
                      highlight={post.id === highlightId}
                    />
                  </motion.li>
                ))}
              </ol>
            </>
          )}
          {stale ? (
            <div
              aria-hidden="true"
              className="text-gold-300 pointer-events-none absolute top-3 right-3"
            >
              <Spinner size="sm" />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        {t('community.list.loading')}
      </p>
      <ul aria-hidden="true" className="flex flex-col gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="border-gold-300/15 bg-felt-800/60 flex animate-pulse overflow-hidden rounded-2xl border"
            data-testid="post-skeleton"
          >
            <div className="border-gold-300/20 flex w-[4.5rem] shrink-0 flex-col items-center gap-2 border-r border-dashed px-2 py-4 sm:w-[5.25rem]">
              <div className="bg-felt-600/70 h-[4.75rem] w-14 rounded-xl sm:w-16" />
            </div>
            <div className="flex-1 space-y-3 px-4 py-4 sm:px-5">
              <div className="flex gap-2">
                <div className="bg-felt-600/70 h-5 w-24 rounded-full" />
                <div className="bg-felt-600/50 h-5 w-16 rounded-full" />
              </div>
              <div className="bg-felt-600/70 h-5 w-3/4 rounded-md" />
              <div className="bg-felt-600/40 h-4 w-full rounded-md" />
              <div className="bg-felt-600/40 h-4 w-2/3 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({
  type,
  onWrite,
  onShowAll,
  stale,
}: {
  type: TypeFilter;
  onWrite: () => void;
  onShowAll: () => void;
  stale: boolean;
}) {
  const filtered = type !== 'all';
  return (
    <div
      className={cn(
        'border-gold-300/25 relative overflow-hidden rounded-2xl border border-dashed px-5 py-10 text-center transition-opacity sm:px-10',
        stale && 'opacity-60',
      )}
      data-testid="post-empty"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_0%,rgb(245_215_122/0.16),transparent_70%)]"
      />
      <div aria-hidden="true" className="marquee-bulbs mx-auto h-3.5 w-40 opacity-70" />
      <h3 className="font-display text-gold-100 relative mt-5 text-2xl font-bold">
        {filtered ? t('community.empty.filteredTitle') : t('community.empty.title')}
      </h3>
      <p className="text-mist relative mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed">
        {filtered
          ? t('community.empty.filteredBody', { type: postTypeLabel(type).toLowerCase() })
          : t('community.empty.body')}
      </p>
      <div className="relative mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button onClick={onWrite} leadingIcon={<PencilIcon size={18} />}>
          {t('community.empty.write')}
        </Button>
        {filtered ? (
          <Button variant="secondary" onClick={onShowAll}>
            {t('community.empty.showAll')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="border-velvet-400/50 bg-velvet-700/35 flex flex-col items-start gap-3 rounded-2xl border p-5"
      data-testid="post-list-error"
    >
      <p className="text-cream flex items-start gap-2 font-semibold">
        <AlertIcon size={20} className="text-velvet-300 mt-0.5 shrink-0" />
        <span>
          {t('community.list.errorTitle')} — {message}
        </span>
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t('community.list.retry')}
      </Button>
    </div>
  );
}
