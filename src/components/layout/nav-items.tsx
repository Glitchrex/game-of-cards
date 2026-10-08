import { type ReactNode } from 'react';
import {
  BookIcon,
  CardsIcon,
  MailIcon,
  MapIcon,
  TrophyIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { t } from '@/lib/i18n';

export interface NavItem {
  href: string;
  label: string;
  hint: string;
  icon: ReactNode;
}

/** Primary navigation (header + mobile menu), in display order. */
export function primaryNav(): NavItem[] {
  return [
    { href: '/games', label: t('nav.games'), hint: t('nav.hints.games'), icon: <CardsIcon /> },
    { href: '/basics', label: t('nav.basics'), hint: t('nav.hints.basics'), icon: <BookIcon /> },
    { href: '/journey', label: t('nav.journey'), hint: t('nav.hints.journey'), icon: <MapIcon /> },
    {
      href: '/community',
      label: t('nav.community'),
      hint: t('nav.hints.community'),
      icon: <UsersIcon />,
    },
    { href: '/contact', label: t('nav.contact'), hint: t('nav.hints.contact'), icon: <MailIcon /> },
  ];
}

/** Extra destinations shown only in the mobile menu. */
export function secondaryNav(): NavItem[] {
  return [
    { href: '/stats', label: t('nav.stats'), hint: t('nav.hints.stats'), icon: <TrophyIcon /> },
  ];
}

/** True when `pathname` is `href` or a page nested under it. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
