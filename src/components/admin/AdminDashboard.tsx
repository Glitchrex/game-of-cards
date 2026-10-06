'use client';
/**
 * The logged-in admin view: stat tiles, toolbar (refresh / log out) and tabs
 * for posts, comments, contact messages and lesson ratings. Every mutation
 * updates the screen straight away and then reloads the overview.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { AlertIcon } from '@/components/ui/icons';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import {
  adminDeleteComment,
  adminDeleteMessage,
  adminDeletePost,
  adminLogout,
  adminOverview,
  adminSetMessageRead,
  adminSetPostStatus,
  type AdminComment,
  type AdminOverview,
  type AdminPost,
  type ApiFailure,
  type ApiResult,
  type ContactMessage,
  type PostStatus,
} from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { postStatusLabel } from '@/components/community/PostBadges';
import { CommentsPanel } from './CommentsPanel';
import { MessagesPanel } from './MessagesPanel';
import { PostsPanel } from './PostsPanel';
import { RatingsPanel } from './RatingsPanel';

export type AdminTab = 'posts' | 'comments' | 'messages' | 'ratings';

export interface AdminDashboardProps {
  gameNames: Readonly<Record<string, string>>;
  /** Session ended (401) — show the login form with a notice. */
  onExpired: () => void;
  /** Server reports admin disabled (503). */
  onDisabled: () => void;
  /** Logged out on purpose. */
  onLoggedOut: () => void;
}

type ConfirmTarget =
  | { kind: 'post'; item: AdminPost }
  | { kind: 'comment'; item: AdminComment }
  | { kind: 'message'; item: ContactMessage };

const TAB_HEADINGS: Record<AdminTab, string> = {
  posts: 'admin-posts-heading',
  comments: 'admin-comments-heading',
  messages: 'admin-messages-heading',
  ratings: 'admin-ratings-heading',
};

function without<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

export function AdminDashboard({
  gameNames,
  onExpired,
  onDisabled,
  onLoggedOut,
}: AdminDashboardProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [tab, setTab] = useState<AdminTab>('posts');
  const [savingPosts, setSavingPosts] = useState<ReadonlySet<number>>(() => new Set());
  const [savingMessages, setSavingMessages] = useState<ReadonlySet<number>>(() => new Set());
  /** What the confirm dialog is about; kept while it animates closed. */
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  /** Heading to focus after a deletion (the deleted row's button is gone). */
  const focusAfterDelete = useRef<string | null>(null);

  // Latest callbacks in a ref, so `load` stays stable even if the parent passes new functions.
  const callbacks = useRef({ onExpired, onDisabled });
  useEffect(() => {
    callbacks.current = { onExpired, onDisabled };
  });

  /** Shared handling for auth failures; returns true when the failure was handled. */
  const handleAuthFailure = useCallback((res: ApiFailure): boolean => {
    if (res.status === 401) {
      callbacks.current.onExpired();
      return true;
    }
    if (res.status === 503) {
      callbacks.current.onDisabled();
      return true;
    }
    return false;
  }, []);

  const applyOverview = useCallback(
    (res: ApiResult<AdminOverview>) => {
      if (res.ok) {
        setOverview(res.data);
        setLoadError(null);
        return;
      }
      if (!handleAuthFailure(res)) setLoadError(res.error);
    },
    [handleAuthFailure],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void adminOverview({ signal: ctrl.signal }).then((res) => {
      if (!ctrl.signal.aborted) applyOverview(res);
    });
    return () => ctrl.abort();
  }, [applyOverview]);

  /** Reload everything (after each mutation and from the Refresh button). */
  const load = async () => applyOverview(await adminOverview());

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = focusAfterDelete.current;
    if (!id || confirmOpen) return;
    focusAfterDelete.current = null;
    document.getElementById(id)?.focus();
  });

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const failed = (res: ApiFailure) => {
    if (handleAuthFailure(res)) return;
    toast({ message: res.error, tone: 'error' });
    void load();
  };

  const changeStatus = async (post: AdminPost, status: PostStatus) => {
    if (status === post.status) return;
    setSavingPosts((s) => new Set(s).add(post.id));
    setOverview((o) =>
      o ? { ...o, posts: o.posts.map((p) => (p.id === post.id ? { ...p, status } : p)) } : o,
    );
    const res = await adminSetPostStatus(post.id, status);
    setSavingPosts((s) => without(s, post.id));
    if (!res.ok) return failed(res);
    const message = t('admin.posts.statusChanged', {
      title: post.title,
      status: postStatusLabel(status),
    });
    toast(message);
    await load();
  };

  const toggleRead = async (message: ContactMessage) => {
    const read = !message.read;
    setSavingMessages((s) => new Set(s).add(message.id));
    setOverview((o) =>
      o ? { ...o, messages: o.messages.map((m) => (m.id === message.id ? { ...m, read } : m)) } : o,
    );
    const res = await adminSetMessageRead(message.id, read);
    setSavingMessages((s) => without(s, message.id));
    if (!res.ok) return failed(res);
    announce(read ? t('admin.messages.markedRead') : t('admin.messages.markedUnread'));
    await load();
  };

  const askDelete = (target: ConfirmTarget) => {
    setConfirm(target);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!confirm || !confirmOpen || deleting) return;
    setDeleting(true);
    const target = confirm;
    const res =
      target.kind === 'post'
        ? await adminDeletePost(target.item.id)
        : target.kind === 'comment'
          ? await adminDeleteComment(target.item.id)
          : await adminDeleteMessage(target.item.id);
    setDeleting(false);
    if (!res.ok) {
      setConfirmOpen(false);
      return failed(res);
    }
    const id = target.item.id;
    setOverview((o) => {
      if (!o) return o;
      if (target.kind === 'post') {
        return {
          ...o,
          posts: o.posts.filter((p) => p.id !== id),
          comments: o.comments.filter((c) => c.postId !== id),
        };
      }
      if (target.kind === 'comment') {
        return { ...o, comments: o.comments.filter((c) => c.id !== id) };
      }
      return { ...o, messages: o.messages.filter((m) => m.id !== id) };
    });
    focusAfterDelete.current = TAB_HEADINGS[tab];
    setConfirmOpen(false);
    toast(
      target.kind === 'post'
        ? t('admin.posts.deleted')
        : target.kind === 'comment'
          ? t('admin.comments.deleted')
          : t('admin.messages.deleted'),
    );
    await load();
  };

  const logout = async () => {
    setLoggingOut(true);
    const res = await adminLogout();
    setLoggingOut(false);
    if (!res.ok && res.status !== 401) {
      toast({ message: res.error, tone: 'error' });
      return;
    }
    toast(t('admin.toolbar.loggedOut'));
    onLoggedOut();
  };

  const unread = overview ? overview.messages.filter((m) => !m.read).length : 0;
  // The summary covers every rating; the list is capped at the newest 1,000.
  const ratingTotal = overview
    ? overview.ratingSummary.reduce((sum, row) => sum + row.count, 0)
    : 0;
  const countBadge = (n: number, highlight = false, srSuffix?: string) => (
    <span
      className={
        highlight
          ? 'bg-velvet-600 text-cream tabular rounded-full px-1.5 text-xs leading-5'
          : 'tabular rounded-full bg-black/25 px-1.5 text-xs leading-5'
      }
    >
      {n.toLocaleString('en-US')}
      {srSuffix ? <span className="sr-only"> {srSuffix}</span> : null}
    </span>
  );

  return (
    <div className="flex flex-col gap-6" data-testid="admin-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-gold-100 text-2xl font-bold outline-none sm:text-3xl"
        >
          {t('admin.login.welcome')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            loading={refreshing}
            loadingLabel={t('admin.toolbar.refreshing')}
            data-testid="admin-refresh"
          >
            {t('admin.toolbar.refresh')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            loading={loggingOut}
            loadingLabel={t('admin.toolbar.loggingOut')}
            data-testid="admin-logout"
          >
            {t('admin.toolbar.logout')}
          </Button>
        </div>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="border-velvet-400/50 bg-velvet-700/35 flex flex-wrap items-center gap-3 rounded-2xl border p-4"
        >
          <AlertIcon size={20} className="text-velvet-300 shrink-0" />
          <p className="text-cream min-w-0 flex-1 font-semibold">
            {t('admin.errors.load')} {loadError}
          </p>
          <Button variant="secondary" size="sm" onClick={refresh}>
            {t('admin.errors.retry')}
          </Button>
        </div>
      ) : null}

      {overview ? (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="admin-stats">
            <StatTile label={t('admin.stats.posts')} value={overview.posts.length} />
            <StatTile label={t('admin.stats.comments')} value={overview.comments.length} />
            <StatTile label={t('admin.stats.unread')} value={unread} accent={unread > 0} />
            <StatTile label={t('admin.stats.ratings')} value={ratingTotal} />
          </dl>

          <Tabs
            label={t('admin.tabs.label')}
            // Four tabs don't fit a phone in one row: use a 2 × 2 grid there.
            listClassName="max-sm:grid max-sm:grid-cols-2 max-sm:[&>[role=tab]]:justify-center"
            value={tab}
            onValueChange={(id) => setTab(id as AdminTab)}
            items={[
              {
                id: 'posts',
                testId: 'admin-tab-posts',
                label: t('admin.tabs.posts'),
                badge: countBadge(overview.posts.length),
                content: (
                  <PostsPanel
                    posts={overview.posts}
                    savingIds={savingPosts}
                    onStatusChange={changeStatus}
                    onDelete={(item) => askDelete({ kind: 'post', item })}
                  />
                ),
              },
              {
                id: 'comments',
                testId: 'admin-tab-comments',
                label: t('admin.tabs.comments'),
                badge: countBadge(overview.comments.length),
                content: (
                  <CommentsPanel
                    comments={overview.comments}
                    onDelete={(item) => askDelete({ kind: 'comment', item })}
                  />
                ),
              },
              {
                id: 'messages',
                testId: 'admin-tab-messages',
                label: t('admin.tabs.messages'),
                badge: countBadge(unread, unread > 0, t('admin.tabs.unread')),
                content: (
                  <MessagesPanel
                    messages={overview.messages}
                    savingIds={savingMessages}
                    onToggleRead={toggleRead}
                    onDelete={(item) => askDelete({ kind: 'message', item })}
                  />
                ),
              },
              {
                id: 'ratings',
                testId: 'admin-tab-ratings',
                label: t('admin.tabs.ratings'),
                badge: countBadge(ratingTotal),
                content: (
                  <RatingsPanel
                    ratings={overview.ratings}
                    summary={overview.ratingSummary}
                    gameNames={gameNames}
                  />
                ),
              },
            ]}
          />
        </>
      ) : loadError ? null : (
        <DashboardSkeleton />
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        dismissible={!deleting}
        role="alertdialog"
        size="sm"
        title={confirmTitle(confirm)}
        description={confirmBody(confirm)}
        initialFocusRef={cancelRef}
        footer={
          <>
            <Button
              ref={cancelRef}
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
              data-testid="admin-confirm-cancel"
            >
              {t('admin.confirm.keep')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={deleting}
              loadingLabel={t('admin.common.deleting')}
              data-testid="admin-confirm-delete"
            >
              {t('admin.confirm.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function confirmTitle(target: ConfirmTarget | null): string {
  if (target?.kind === 'comment') return t('admin.confirm.commentTitle');
  if (target?.kind === 'message') return t('admin.confirm.messageTitle');
  return t('admin.confirm.postTitle');
}

function confirmBody(target: ConfirmTarget | null): ReactNode {
  if (!target) return null;
  if (target.kind === 'post') return t('admin.confirm.postBody', { title: target.item.title });
  if (target.kind === 'comment') {
    return t('admin.confirm.commentBody', {
      name: target.item.authorName ?? t('admin.common.anonymous'),
    });
  }
  return t('admin.confirm.messageBody', { name: target.item.name });
}

function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? 'border-gold-300/60 relative overflow-hidden rounded-2xl border bg-[radial-gradient(120%_120%_at_0%_0%,rgb(245_215_122/0.18),transparent_60%)] px-4 py-3'
          : 'border-gold-300/20 bg-felt-800/60 relative overflow-hidden rounded-2xl border px-4 py-3'
      }
    >
      <dt className="text-mist text-xs font-semibold tracking-wide uppercase">{label}</dt>
      <dd className="font-display text-gold-100 tabular mt-1 text-3xl font-black">
        {value.toLocaleString('en-US')}
      </dd>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div data-testid="admin-loading">
      <p role="status" className="sr-only">
        {t('common.loading')}
      </p>
      <div aria-hidden="true" className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-felt-800/70 h-[4.75rem] rounded-2xl" />
          ))}
        </div>
        <div className="bg-felt-800/70 h-12 rounded-xl" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-felt-800/60 h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
