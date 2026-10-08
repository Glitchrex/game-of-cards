'use client';
import Link from 'next/link';
import { RelativeTime } from '@/components/community/RelativeTime';
import { Button } from '@/components/ui/Button';
import { type AdminComment } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { ExpandableText, PanelEmpty, PanelHeading } from './PanelBits';

export interface CommentsPanelProps {
  comments: AdminComment[];
  onDelete: (comment: AdminComment) => void;
}

export function CommentsPanel({ comments, onDelete }: CommentsPanelProps) {
  return (
    <section aria-labelledby="admin-comments-heading">
      <PanelHeading id="admin-comments-heading" count={comments.length}>
        {t('admin.comments.heading')}
      </PanelHeading>
      {comments.length === 0 ? (
        <PanelEmpty>{t('admin.comments.empty')}</PanelEmpty>
      ) : (
        <ul className="mt-4 grid gap-3">
          {comments.map((c) => {
            const name = c.authorName ?? t('admin.common.anonymous');
            return (
              <li
                key={c.id}
                data-testid={`admin-comment-${c.id}`}
                className="border-gold-300/20 bg-felt-800/70 rounded-2xl border p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="text-cream font-semibold">{name}</span>
                  <RelativeTime iso={c.createdAt} className="text-mist text-[0.8125rem]" />
                  <Link
                    href={`/community/${c.postId}#comment-${c.id}`}
                    className="text-gold-200 hover:text-gold-100 min-w-0 basis-full truncate font-semibold underline underline-offset-4 sm:basis-auto"
                  >
                    {t('admin.comments.on', { title: c.postTitle })}
                  </Link>
                </div>
                <ExpandableText text={c.body} limit={320} className="mt-2" />
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(c)}
                    aria-label={t('admin.comments.deleteFor', { name })}
                    data-testid={`admin-comment-delete-${c.id}`}
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
