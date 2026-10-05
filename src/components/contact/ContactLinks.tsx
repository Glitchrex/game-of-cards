/** GitHub button + email (mailto + copy). Server component; the copy button is a client island. */
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ExternalIcon, GitHubMark, MailIcon } from '@/components/ui/icons';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { CopyEmailButton } from './CopyEmailButton';

export function ContactLinks({ className }: { className?: string }) {
  const { githubUrl, githubHandle, email } = siteConfig.creator;
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Button
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('contact.github.aria')}
        variant="primary"
        className="justify-between"
        fullWidth
        leadingIcon={<GitHubMark size={22} />}
        trailingIcon={<ExternalIcon size={16} />}
      >
        <span className="flex flex-1 items-baseline gap-2 text-left">
          {t('contact.github.label')}
          <span className="text-ink/70 text-sm font-medium">@{githubHandle}</span>
        </span>
      </Button>
      <div className="border-gold-300/25 bg-felt-950/45 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
        <a
          href={`mailto:${email}`}
          aria-label={t('contact.email.mailto', { email })}
          className="text-gold-100 hover:text-gold-200 flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 font-semibold underline-offset-4 hover:underline"
          data-testid="contact-email"
        >
          <MailIcon size={20} className="text-gold-300 shrink-0" />
          <span className="break-all">{email}</span>
        </a>
        <CopyEmailButton email={email} className="sm:shrink-0" />
      </div>
    </div>
  );
}
