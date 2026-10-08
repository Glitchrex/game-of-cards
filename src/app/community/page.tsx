import type { Metadata } from 'next';
import { CommunityBoard } from '@/components/community/CommunityBoard';
import { StatusPipeline } from '@/components/community/StatusPipeline';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: t('community.meta.title'),
  description: t('community.meta.description'),
  alternates: { canonical: '/community' },
  openGraph: {
    title: t('community.meta.title'),
    description: t('community.meta.description'),
    url: '/community',
  },
};

export default function CommunityPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Spotlight from above + velvet curtain glow at the edges. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(60%_70%_at_50%_0%,rgb(245_215_122/0.14),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -left-40 h-[30rem] w-80 rotate-12 bg-[radial-gradient(closest-side,rgb(158_32_54/0.28),transparent)] max-md:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -right-40 h-[30rem] w-80 -rotate-12 bg-[radial-gradient(closest-side,rgb(158_32_54/0.28),transparent)] max-md:hidden"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="border-gold-300/40 bg-felt-950/50 text-gold-300 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.24em] uppercase">
            <span aria-hidden="true" className="animate-bulb bg-gold-300 size-1.5 rounded-full" />
            {t('community.page.eyebrow')}
          </p>
          <h1 className="font-display text-foil mt-4 text-[2.5rem] leading-[1.05] font-black tracking-[-0.02em] sm:text-6xl">
            {t('community.page.title')}
          </h1>
          <p className="font-display text-gold-100 mt-3 text-xl font-semibold italic sm:text-2xl">
            {t('community.page.intro')}
          </p>
          <p className="text-mist mx-auto mt-3 max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
            {t('community.page.lead')}
          </p>
          <a
            href="#board"
            className="text-gold-200 hover:text-gold-100 mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold underline underline-offset-4 lg:hidden"
          >
            {t('community.page.jump')}
            <span aria-hidden="true">↓</span>
          </a>
        </header>

        <StatusPipeline className="mx-auto mt-8 max-w-3xl" />

        <div className="mt-10 sm:mt-12">
          <CommunityBoard />
        </div>
      </div>
    </div>
  );
}
