import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { siteConfig } from '@/config/site';
import { Header } from '@/components/layout/Header';
import { Wordmark } from '@/components/layout/Wordmark';
import { Footer } from '@/components/layout/Footer';
import { FeedbackButton } from '@/components/layout/FeedbackButton';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { Toaster } from '@/components/ui/Toast';
import { AppEffects } from '@/components/layout/AppEffects';
import { StoreHydrator } from '@/store/hydrate';
import './globals.css';

const fraunces = localFont({
  src: [
    { path: './fonts/fraunces.woff2', style: 'normal', weight: '100 900' },
    { path: './fonts/fraunces-italic.woff2', style: 'italic', weight: '100 900' },
  ],
  variable: '--font-fraunces',
  display: 'swap',
  preload: true,
});

const jakarta = localFont({
  src: [{ path: './fonts/jakarta.woff2', style: 'normal', weight: '200 800' }],
  variable: '--font-jakarta',
  display: 'swap',
  preload: true,
});

/**
 * The favicon (public/icon.svg, also used by the web manifest) inlined as a data URI: one
 * request fewer competing with the page's own CSS, fonts and scripts on first load.
 */
const ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  readFileSync(path.join(process.cwd(), 'public/icon.svg'), 'utf8')
    .replace(/\s*\n\s*/g, ' ')
    .trim(),
)}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  icons: { icon: [{ url: ICON_DATA_URI, type: 'image/svg+xml', sizes: 'any' }] },
  title: {
    default: `${siteConfig.name} — Learn every card game, the fun way`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Learn every card game, the fun way`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: '#062417',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only-focusable bg-gold-300 text-ink fixed top-2 left-2 z-[100] rounded-md px-4 py-2 font-semibold"
        >
          Skip to content
        </a>
        <StoreHydrator />
        <AppEffects />
        <Header logo={<Wordmark size="sm" decorative className="max-[389px]:w-[118px]" />} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <FeedbackButton />
        <Toaster />
        <LiveAnnouncer />
      </body>
    </html>
  );
}
