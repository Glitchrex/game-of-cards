/**
 * Site footer (server component): wordmark, link groups, GitHub + email,
 * the pretend-money notice and the copyright line.
 */
import Link from 'next/link';
import { GitHubMark, MailIcon, ShieldNoticeIcon } from '@/components/ui/icons';
import { CoinIcon } from '@/components/ui/Jeet';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { Wordmark } from './Wordmark';

interface FooterLink {
  href: string;
  label: string;
}

function linkGroups(): Array<{ title: string; links: FooterLink[] }> {
  return [
    {
      title: t('nav.footer.learn'),
      links: [
        { href: '/games', label: t('nav.footer.games') },
        { href: '/basics', label: t('nav.footer.basics') },
        { href: '/journey', label: t('nav.footer.journey') },
      ],
    },
    {
      title: t('nav.footer.you'),
      links: [{ href: '/stats', label: t('nav.footer.stats') }],
    },
    {
      title: t('nav.footer.community'),
      links: [
        { href: '/community', label: t('nav.footer.board') },
        { href: '/contact', label: t('nav.footer.contact') },
      ],
    },
  ];
}

const linkClass =
  'inline-flex min-h-11 items-center text-[0.9375rem] text-cream/85 underline-offset-4 transition-colors hover:text-gold-200 hover:underline';

export function Footer() {
  const year = new Date().getFullYear();
  const { email, githubUrl } = siteConfig.creator;
  return (
    <footer className="border-gold-300/25 bg-felt-950 text-cream relative mt-16 border-t">
      {/* marquee strip along the top edge */}
      <div
        aria-hidden="true"
        className="marquee-bulbs pointer-events-none absolute inset-x-0 -top-[5px] h-[10px] [background-size:18px_10px] [background-repeat:space_no-repeat] opacity-70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgb(20_110_72/0.22),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1200px] px-4 pt-12 pb-28 [contain-intrinsic-size:auto_930px] [content-visibility:auto] sm:px-6 sm:pb-12 lg:px-8 lg:[contain-intrinsic-size:auto_470px]">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_2fr]">
          <div className="flex flex-col items-start gap-5">
            <Link
              href="/"
              aria-label={t('nav.homeLabel')}
              className="rounded-2xl transition-[filter] hover:brightness-110"
            >
              <Wordmark size="md" decorative />
            </Link>
            <p className="font-display text-gold-100 max-w-xs text-lg leading-snug italic">
              {t('nav.footer.tagline')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('nav.footer.githubLabel')}
                title={t('nav.footer.github')}
                className="border-gold-300/35 text-gold-200 hover:border-gold-300 hover:bg-gold-300/10 inline-flex size-11 items-center justify-center rounded-full border transition-colors"
              >
                <GitHubMark size={22} />
              </a>
              <a
                href={`mailto:${email}`}
                className="border-gold-300/35 text-gold-200 hover:border-gold-300 hover:bg-gold-300/10 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors"
              >
                <MailIcon size={18} />
                <span className="sr-only">{t('nav.footer.email')}: </span>
                <span className="break-all">{email}</span>
              </a>
            </div>
          </div>

          <nav aria-label={t('nav.footer.label')}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
              {linkGroups().map((group) => (
                <div key={group.title}>
                  <h2 className="text-gold-300 text-xs font-bold tracking-[0.22em] uppercase">
                    {group.title}
                  </h2>
                  <ul className="mt-2 flex flex-col sm:mt-3">
                    {group.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className={linkClass}>
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </div>

        <div className="border-gold-300/45 mt-10 flex items-center gap-3 rounded-2xl border bg-[linear-gradient(100deg,rgb(116_22_40/0.55),rgb(10_53_36/0.7)_60%)] px-4 py-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] sm:px-5">
          <span aria-hidden="true" className="relative inline-flex shrink-0">
            <CoinIcon size={34} />
            <ShieldNoticeIcon
              size={16}
              className="bg-felt-950 text-gold-200 absolute -right-1 -bottom-1 rounded-full"
            />
          </span>
          <p
            data-testid="pretend-money-notice"
            className="text-cream text-[0.9375rem] font-semibold"
          >
            {siteConfig.currency.notice}
          </p>
        </div>

        <div className="border-gold-300/15 text-mist mt-8 flex flex-col gap-2 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{t('nav.footer.copyright', { year, name: siteConfig.name })}</p>
          <p className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase">
            <span aria-hidden="true" className="animate-bulb bg-gold-300 size-1.5 rounded-full" />
            {t('nav.footer.nowShowing')}
          </p>
        </div>
      </div>
    </footer>
  );
}
