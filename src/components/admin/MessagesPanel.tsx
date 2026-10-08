'use client';
import { RelativeTime } from '@/components/community/RelativeTime';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { MailIcon } from '@/components/ui/icons';
import { type ContactMessage } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { ExpandableText, PanelEmpty, PanelHeading } from './PanelBits';

export interface MessagesPanelProps {
  messages: ContactMessage[];
  /** Message ids with a read/unread change in flight. */
  savingIds: ReadonlySet<number>;
  onToggleRead: (message: ContactMessage) => void;
  onDelete: (message: ContactMessage) => void;
}

export function MessagesPanel({ messages, savingIds, onToggleRead, onDelete }: MessagesPanelProps) {
  const unread = messages.filter((m) => !m.read).length;
  return (
    <section aria-labelledby="admin-messages-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelHeading id="admin-messages-heading" count={messages.length}>
          {t('admin.messages.heading')}
        </PanelHeading>
        {unread > 0 ? (
          <span className="text-gold-200 text-sm font-semibold">
            {t('admin.messages.unreadCount', { count: unread })}
          </span>
        ) : null}
      </div>
      {messages.length === 0 ? (
        <PanelEmpty>{t('admin.messages.empty')}</PanelEmpty>
      ) : (
        <ul className="mt-4 grid gap-3">
          {messages.map((m) => {
            const saving = savingIds.has(m.id);
            return (
              <li
                key={m.id}
                data-testid={`admin-message-${m.id}`}
                data-read={m.read}
                className={cn(
                  'relative rounded-2xl border p-4 sm:p-5',
                  m.read
                    ? 'border-gold-300/15 bg-felt-800/50'
                    : 'border-gold-300/45 bg-felt-800/85 shadow-[inset_3px_0_0_var(--color-gold-300)]',
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {m.read ? (
                    <Badge tone="mist" size="sm">
                      {t('admin.messages.read')}
                    </Badge>
                  ) : (
                    <Badge tone="gold" size="sm" icon={<MailIcon size={12} />}>
                      {t('admin.messages.unread')}
                    </Badge>
                  )}
                  <span className="text-cream font-semibold break-words">{m.name}</span>
                  <a
                    href={`mailto:${m.email}`}
                    className="text-gold-200 hover:text-gold-100 inline-flex min-w-0 items-center gap-1.5 text-sm break-all underline underline-offset-4"
                    data-testid={`admin-message-email-${m.id}`}
                  >
                    <MailIcon size={14} className="shrink-0" />
                    {m.email}
                  </a>
                  <span className="text-mist ml-auto text-[0.8125rem]">
                    <RelativeTime iso={m.createdAt} />
                  </span>
                </div>
                <ExpandableText text={m.message} limit={420} className="mt-2.5" />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={saving}
                    onClick={() => onToggleRead(m)}
                    data-testid={`admin-message-read-${m.id}`}
                  >
                    {m.read ? t('admin.messages.markUnread') : t('admin.messages.markRead')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(m)}
                    aria-label={t('admin.messages.deleteFor', { name: m.name })}
                    data-testid={`admin-message-delete-${m.id}`}
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
