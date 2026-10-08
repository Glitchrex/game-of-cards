'use client';
/** Navigation sheet for phones and tablets (bottom sheet / side panel). */
import Link from 'next/link';
import { useId } from 'react';
import { cn } from '@/components/ui/cn';
import { ChevronRightIcon, MegaphoneIcon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { openFeedback } from './FeedbackButton';
import { isActivePath, primaryNav, secondaryNav, type NavItem } from './nav-items';
import { SettingsPanel } from './SettingsPanel';

export interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  pathname: string;
}

function Row({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex min-h-16 items-center gap-3.5 rounded-2xl border px-3.5 py-2.5 transition-[background-color,border-color] duration-150',
        active
          ? 'border-gold-300/70 bg-gold-300/10'
          : 'border-gold-300/10 bg-felt-900/50 hover:border-gold-300/40 hover:bg-felt-700/50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border',
          active
            ? 'border-gold-200 text-ink bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))]'
            : 'border-gold-300/30 bg-felt-950/60 text-gold-200',
        )}
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'font-display block text-lg leading-tight font-bold',
            active ? 'text-gold-100' : 'text-cream',
          )}
        >
          {item.label}
        </span>
        <span className="text-mist block truncate text-[0.8125rem]">{item.hint}</span>
      </span>
      <ChevronRightIcon
        size={18}
        className="text-gold-300/70 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </Link>
  );
}

export function MobileNav({ open, onClose, pathname }: MobileNavProps) {
  const settingsId = useId();
  const showFeedback = !pathname.startsWith('/admin');
  return (
    <Sheet open={open} onClose={onClose} eyebrow={siteConfig.name} title={t('nav.menuTitle')}>
      <nav aria-label={t('nav.main')}>
        <ul className="grid grid-cols-1 gap-2">
          {[...primaryNav(), ...secondaryNav()].map((item) => (
            <li key={item.href}>
              <Row item={item} active={isActivePath(pathname, item.href)} onNavigate={onClose} />
            </li>
          ))}
        </ul>
      </nav>

      {showFeedback ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            openFeedback();
          }}
          className="border-gold-300/40 text-gold-200 hover:border-gold-300 hover:bg-gold-300/10 mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-sm font-semibold transition-colors"
        >
          <MegaphoneIcon size={18} />
          {t('nav.sendFeedback')}
        </button>
      ) : null}

      <section
        aria-labelledby={settingsId}
        className="border-gold-300/15 bg-felt-950/40 mt-6 rounded-2xl border p-4"
      >
        <h3
          id={settingsId}
          className="text-gold-300 mb-4 text-xs font-bold tracking-[0.2em] uppercase"
        >
          {t('nav.menuSettings')}
        </h3>
        <SettingsPanel includeSound />
      </section>
    </Sheet>
  );
}
