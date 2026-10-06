'use client';
/**
 * Sticky site header: translucent felt with a gold hairline, the marquee
 * wordmark, primary nav (desktop), wallet pill, sound toggle, settings, and a
 * menu button that opens the navigation sheet on phones/tablets.
 *
 * First-load budget: the navigation sheet is fetched on demand (warmed up on hover/focus of
 * the menu button), and the active-link underline slides between links with a tiny FLIP
 * animation (Web Animations API) instead of an animation library.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/ui/IconButton';
import { MenuIcon } from '@/components/ui/icons';
import { lazyComponent } from '@/components/ui/lazy';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type MobileNavProps } from './MobileNav';
import { isActivePath, primaryNav } from './nav-items';
import { SettingsMenu } from './SettingsMenu';
import { SoundToggle } from './SoundToggle';
import { WalletPill } from './WalletPill';

const mobileNav = lazyComponent<MobileNavProps>(() =>
  import('./MobileNav').then((mod) => mod.MobileNav),
);
const warmUpMobileNav = () => {
  mobileNav.load().catch(() => {
    /* retried when the menu opens */
  });
};

/** Slide time of the active-link underline (ms) and its easing (a gentle, springy settle). */
const SLIDE_MS = 380;
const SLIDE_EASE = 'cubic-bezier(0.2, 0.9, 0.25, 1.05)';

/**
 * Slides the active-link underline from where it was on the previous route to where it is
 * now (measure → invert → play). Returns the ref for the underline element.
 */
function useSlidingIndicator(pathname: string, reduce: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const prev = last.current;
    if (!el) {
      last.current = null;
      return;
    }
    const next = el.getBoundingClientRect();
    last.current = next;
    if (!prev || reduce || typeof el.animate !== 'function' || next.width === 0) return;
    if (prev.left === next.left && prev.width === next.width) return;
    el.animate(
      [
        { transform: `translateX(${prev.left - next.left}px) scaleX(${prev.width / next.width})` },
        { transform: 'none' },
      ],
      { duration: SLIDE_MS, easing: SLIDE_EASE },
    );
  }, [pathname, reduce]);

  // Keep the remembered position current when the layout changes (resize, font load).
  useEffect(() => {
    const remember = () => {
      if (ref.current) last.current = ref.current.getBoundingClientRect();
    };
    window.addEventListener('resize', remember, { passive: true });
    return () => window.removeEventListener('resize', remember);
  }, []);

  return ref;
}

function subscribeScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

function useScrolled(): boolean {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 8,
    () => false,
  );
}

export interface HeaderProps {
  /**
   * The marquee wordmark shown in the home link. Rendered by the (server) root layout and
   * passed in, so its SVG markup isn't part of the client bundle.
   */
  logo?: ReactNode;
}

export function Header({ logo }: HeaderProps) {
  const pathname = usePathname() ?? '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  // Close the menu when the route changes (e.g. browser back while it's open).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }
  const scrolled = useScrolled();
  const reduce = useReducedMotionPref();
  const items = primaryNav();
  const indicatorRef = useSlidingIndicator(pathname, reduce);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow] duration-300',
        // The frosted-glass blur only matters once content scrolls underneath; skipping it
        // at the top keeps the first frames cheap to composite.
        scrolled
          ? 'bg-felt-950/85 shadow-[0_12px_30px_-18px_rgb(0_0_0/0.9)] backdrop-blur-md backdrop-saturate-150'
          : 'bg-felt-900/70',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-2.5 min-[390px]:px-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label={t('nav.homeLabel')}
          className="ease-snap -ml-0.5 shrink-0 rounded-xl p-0.5 transition-[transform,filter] duration-300 hover:scale-[1.03] hover:brightness-110"
        >
          {logo}
        </Link>

        <nav aria-label={t('nav.main')} className="ml-3 hidden lg:block xl:ml-6">
          <ul className="flex items-center gap-0.5">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex min-h-11 items-center rounded-full px-3.5 text-[0.9375rem] font-semibold transition-colors duration-150',
                      active ? 'text-gold-200' : 'text-cream/85 hover:text-gold-100',
                    )}
                  >
                    {item.label}
                    {active ? (
                      <span
                        ref={indicatorRef}
                        aria-hidden="true"
                        className="bg-gold-300 absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full shadow-[0_0_10px_2px_rgb(245_215_122/0.55)]"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-0.5 min-[390px]:gap-1 sm:gap-1.5">
          <WalletPill />
          <SoundToggle className="max-[374px]:hidden" />
          <SettingsMenu className="hidden sm:inline-flex" />
          <IconButton
            label={t('nav.openMenu')}
            icon={<MenuIcon size={24} />}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            onPointerEnter={warmUpMobileNav}
            onFocus={warmUpMobileNav}
            className="lg:hidden"
            data-testid="menu-button"
          />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgb(245_215_122/0.5)_18%,rgb(245_215_122/0.85)_50%,rgb(245_215_122/0.5)_82%,transparent)]"
      />
      <mobileNav.Render
        wanted={menuOpen}
        onLoadError={() => setMenuOpen(false)}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
      />
    </header>
  );
}
