/** "About the creator" card. Content comes from content/about.ts. */
import { about } from '@content/about';
import { cn } from '@/components/ui/cn';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { ContactLinks } from './ContactLinks';

export function CreatorCard({ className }: { className?: string }) {
  return (
    <article
      aria-labelledby="creator-name"
      className={cn('panel relative overflow-hidden p-5 sm:p-7', className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-[radial-gradient(circle,rgb(194_47_71/0.28),transparent_70%)]"
      />
      <p className="text-gold-300 text-xs font-bold tracking-[0.22em] uppercase">
        {t('contact.page.aboutHeading')}
      </p>
      <div className="mt-4 flex items-center gap-4">
        <div
          aria-hidden="true"
          className="relative inline-flex size-20 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_200deg,var(--color-gold-100),var(--color-gold-500),var(--color-gold-200),var(--color-gold-700),var(--color-gold-100))] p-[3px] shadow-[0_0_0_4px_rgb(3_17_11/0.7),0_0_28px_-4px_rgb(245_215_122/0.6)] sm:size-24"
        >
          <span className="font-display text-gold-100 flex size-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--color-velvet-500),var(--color-velvet-700)_70%)] text-3xl font-black tracking-tight sm:text-4xl">
            {about.avatarInitials}
          </span>
        </div>
        <div className="min-w-0">
          <h2
            id="creator-name"
            className="font-display text-gold-100 text-2xl leading-tight font-bold sm:text-3xl"
          >
            {about.name}
          </h2>
          <p className="text-mist mt-0.5 text-sm">{about.role}</p>
          <p className="text-gold-200 mt-1 text-sm font-semibold">
            @{siteConfig.creator.githubHandle}
          </p>
        </div>
      </div>
      <div className="text-cream/90 mt-5 flex flex-col gap-3 text-[0.9375rem] leading-relaxed">
        {about.bio.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <h3 className="text-gold-300 mt-7 mb-3 text-xs font-bold tracking-[0.22em] uppercase">
        {t('contact.page.reachHeading')}
      </h3>
      <ContactLinks />
    </article>
  );
}
