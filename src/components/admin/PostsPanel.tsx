'use client';
import Link from 'next/link';
import { plural } from '@/components/community/format';
import { PostStatusBadge, PostTypeBadge, postStatusLabel } from '@/components/community/PostBadges';
import { RelativeTime } from '@/components/community/RelativeTime';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { MailIcon } from '@/components/ui/icons';
import { POST_STATUSES, type AdminPost, type PostStatus } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { ExpandableText, PanelEmpty, PanelHeading } from './PanelBits';

export interface PostsPanelProps {
  posts: AdminPost[];
  /** Post ids with a status change in flight. */
  savingIds: ReadonlySet<number>;
  onStatusChange: (post: AdminPost, status: PostStatus) => void;
  onDelete: (post: AdminPost) => void;
}

const EXCERPT = 280;

export function PostsPanel({ posts, savingIds, onStatusChange, onDelete }: PostsPanelProps) {
  const statusOptions = POST_STATUSES.map((value) => ({ value, label: postStatusLabel(value) }));
  return (
    <section aria-labelledby="admin-posts-heading">
      <PanelHeading id="admin-posts-heading" count={posts.length}>
        {t('admin.posts.heading')}
      </PanelHeading>
      {posts.length === 0 ? (
        <PanelEmpty>{t('admin.posts.empty')}</PanelEmpty>
      ) : (
        <ul className="mt-4 grid gap-3">
          {posts.map((post) => {
            const saving = savingIds.has(post.id);
            return (
              <li
                key={post.id}
                data-testid={`admin-post-${post.id}`}
                data-status={post.status}
                className="border-gold-300/20 bg-felt-800/70 rounded-2xl border p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PostTypeBadge type={post.type} size="sm" />
                  <PostStatusBadge status={post.status} size="sm" />
                  <span className="text-mist ml-auto text-[0.8125rem]">
                    <RelativeTime iso={post.createdAt} />
                  </span>
                </div>
                <h3 className="text-cream mt-2 text-lg leading-snug font-bold break-words">
                  <Link
                    href={`/community/${post.id}`}
                    className="hover:text-gold-100 underline-offset-4 hover:underline"
                  >
                    {post.title}
                  </Link>
                </h3>
                <ExpandableText text={post.body} limit={EXCERPT} className="mt-1.5" />

                <dl className="text-mist mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex min-w-0 gap-2">
                    <dt className="text-gold-300/90 shrink-0 font-semibold">
                      {t('admin.posts.author')}
                    </dt>
                    <dd className="text-cream min-w-0 truncate">
                      {post.authorName ?? t('admin.common.anonymous')}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <dt className="text-gold-300/90 shrink-0 font-semibold">
                      {t('admin.posts.email')}
                    </dt>
                    <dd className="min-w-0 truncate pr-1">
                      {post.authorEmail ? (
                        <a
                          href={`mailto:${post.authorEmail}`}
                          className="text-gold-200 hover:text-gold-100 inline-flex items-center gap-1.5 underline underline-offset-4"
                          data-testid={`admin-post-email-${post.id}`}
                        >
                          <MailIcon size={14} />
                          {post.authorEmail}
                        </a>
                      ) : (
                        <span className="italic">{t('admin.posts.noEmail')}</span>
                      )}
                    </dd>
                  </div>
                  <div className="text-mist tabular flex gap-3 sm:col-span-2">
                    <span>
                      {plural(post.upvotes, 'admin.posts.upvotesOne', 'admin.posts.upvotesMany')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {plural(
                        post.commentCount,
                        'admin.posts.commentsOne',
                        'admin.posts.commentsMany',
                      )}
                    </span>
                  </div>
                </dl>

                <div className="border-gold-300/15 mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
                  <Select
                    label={t('admin.posts.status')}
                    aria-label={`${t('admin.posts.status')}: ${post.title}`}
                    options={statusOptions}
                    value={post.status}
                    disabled={saving}
                    onChange={(e) => onStatusChange(post, e.target.value as PostStatus)}
                    containerClassName="min-w-[11rem] flex-1 sm:max-w-[14rem]"
                    data-testid={`admin-status-${post.id}`}
                    hint={saving ? t('admin.posts.statusSaving') : undefined}
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(post)}
                    aria-label={t('admin.posts.deleteFor', { title: post.title })}
                    data-testid={`admin-delete-${post.id}`}
                    className="ml-auto"
                  >
                    {t('admin.common.delete')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
