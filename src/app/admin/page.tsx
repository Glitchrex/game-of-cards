import type { Metadata } from 'next';
import { AdminApp } from '@/components/admin/AdminApp';
import { getAllGames } from '@/lib/content/catalog';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: t('admin.meta.title'),
  description: t('admin.meta.description'),
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminPage() {
  // Resolved at build time, so the client bundle never ships the whole catalog.
  const gameNames: Record<string, string> = Object.fromEntries(
    getAllGames().map((g) => [g.slug, g.name]),
  );
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(55%_70%_at_50%_0%,rgb(245_215_122/0.11),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1200px] px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:px-8">
        <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <p className="border-gold-300/40 bg-felt-950/50 text-gold-300 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.24em] uppercase">
            <span aria-hidden="true" className="animate-bulb bg-velvet-400 size-1.5 rounded-full" />
            {t('admin.page.eyebrow')}
          </p>
          <h1 className="font-display text-foil mt-4 text-[2.5rem] leading-[1.05] font-black tracking-[-0.02em] sm:text-5xl">
            {t('admin.page.title')}
          </h1>
          <p className="text-mist mt-3 text-base leading-relaxed text-pretty">
            {t('admin.page.intro')}
          </p>
        </header>
        <AdminApp gameNames={gameNames} />
      </div>
    </div>
  );
}
