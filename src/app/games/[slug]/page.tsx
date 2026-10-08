import type { Metadata } from 'next';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { DifficultyPips } from '@/components/catalog/DifficultyPips';
import { flagEmoji } from '@/components/catalog/catalog-data';
import { playersText } from '@/components/catalog/GameCard';
import { HubJourney } from '@/components/catalog/HubJourney';
import { RichTextStatic } from '@/components/learn/RichTextStatic';
import {
  gamePageMetadata,
  gameStaticParams,
  requireGame,
  type SlugParams,
} from '@/components/learn/route-data';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  BookIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CardsIcon,
  SpadeIcon,
  SparkleIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { siteConfig } from '@/config/site';
import { GAME_TYPE_LABELS, REGION_LABELS } from '@/lib/content/schema';
import { type CatalogGame } from '@/lib/content/catalog';
import { t } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return gameStaticParams();
}

export async function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  const meta = await gamePageMetadata(params, (g) => ({
    title: t('catalog.hub.pageTitle', { name: g.name }),
    description: g.seo.description,
    path: `/games/${g.slug}`,
  }));
  if (meta.openGraph) meta.openGraph = { ...meta.openGraph, type: 'article' };
  return meta;
}

function jsonLd(game: CatalogGame) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Game',
    name: game.name,
    ...(game.aka?.length ? { alternateName: game.aka } : {}),
    description: game.seo.description,
    url: `${siteConfig.url}/games/${game.slug}`,
    genre: GAME_TYPE_LABELS[game.type],
    inLanguage: 'en',
    isAccessibleForFree: true,
    countryOfOrigin: { '@type': 'Country', name: game.origin.country },
    numberOfPlayers: {
      '@type': 'QuantitativeValue',
      minValue: game.players.min,
      maxValue: game.players.max,
    },
    audience: { '@type': 'Audience', audienceType: t('catalog.hub.audience') },
    publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
  };
  // Escape "<" so content can never close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function Fact({ label, children, icon }: { label: string; children: ReactNode; icon: ReactNode }) {
  return (
    <div className="border-gold-300/25 bg-felt-950/45 flex min-w-0 flex-col gap-1 rounded-xl border px-3.5 py-3">
      <dt className="text-gold-300 flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.16em] uppercase">
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="text-cream text-[0.9375rem] leading-snug font-semibold">{children}</dd>
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="font-display text-gold-100 text-2xl leading-tight font-bold tracking-[-0.01em] sm:text-[2rem]"
    >
      {children}
    </h2>
  );
}

export default async function GameHubPage({ params }: SlugParams) {
  const game = await requireGame(params);
  const { slug, name } = game;

  return (
    <article className="relative overflow-x-clip" data-testid="game-hub">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(game) }} />

      {/* Hero band */}
      <div className="felt-deep border-gold-300/20 relative border-b">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(55%_75%_at_50%_0%,rgb(245_215_122/0.16),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -left-36 h-full w-72 rotate-6 bg-[radial-gradient(closest-side,rgb(158_32_54/0.3),transparent)] max-md:hidden"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -right-36 h-full w-72 -rotate-6 bg-[radial-gradient(closest-side,rgb(158_32_54/0.3),transparent)] max-md:hidden"
        />
        <div className="relative mx-auto max-w-[1200px] px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14 lg:px-8">
          <nav aria-label={t('learn.header.breadcrumb')}>
            <ol className="text-mist flex flex-wrap items-center gap-1 text-sm font-semibold">
              <li className="flex items-center gap-1">
                <Link
                  href="/games"
                  className="hover:text-gold-200 inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                >
                  {t('learn.header.games')}
                </Link>
                <ChevronRightIcon size={14} className="text-gold-300/70" />
              </li>
              <li aria-current="page" className="text-cream/80">
                {name}
              </li>
            </ol>
          </nav>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="border-gold-300/40 bg-felt-950/55 text-cream inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold">
              <span aria-hidden="true">{flagEmoji(game.origin.countryCode)}</span>
              <span>
                <span className="sr-only">{t('catalog.hub.originLabel')}: </span>
                {game.origin.country}
                <span className="text-mist"> · {REGION_LABELS[game.origin.region]}</span>
              </span>
            </span>
            <Badge tone="outline">{GAME_TYPE_LABELS[game.type]}</Badge>
            {game.tier === 1 ? (
              <Badge tone="gold" icon={<SpadeIcon size={12} />}>
                {t('catalog.card.playVsBot')}
              </Badge>
            ) : null}
          </div>

          <h1 className="font-display text-foil mt-4 text-[2.75rem] leading-[0.98] font-black tracking-[-0.025em] text-balance sm:text-7xl">
            {name}
          </h1>
          {game.aka?.length ? (
            <p className="text-mist mt-3 text-sm italic sm:text-base">
              {t('catalog.hub.aka', { names: game.aka.join(' · ') })}
            </p>
          ) : null}
          <p className="text-cream mt-5 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl">
            {game.hook}
          </p>

          <h2 className="sr-only">{t('catalog.hub.facts')}</h2>
          <dl className="mt-7 grid grid-cols-2 gap-3 sm:max-w-3xl lg:grid-cols-4">
            <Fact label={t('catalog.hub.playersLabel')} icon={<UsersIcon size={14} />}>
              {playersText(game.players)}
            </Fact>
            <Fact label={t('catalog.hub.deckLabel')} icon={<CardsIcon size={14} />}>
              {game.deck}
            </Fact>
            <Fact label={t('catalog.hub.difficultyLabel')} icon={<SparkleIcon size={14} />}>
              <DifficultyPips value={game.difficulty} size="md" className="mt-1" />
            </Fact>
            <Fact label={t('catalog.hub.lengthLabel')} icon={<ClockIcon size={14} />}>
              {game.length}
            </Fact>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              href={`/games/${slug}/learn`}
              size="lg"
              leadingIcon={<BookIcon size={20} />}
              data-testid="hub-start"
            >
              {t('catalog.hub.startLesson')}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <HubJourney slug={slug} name={name} tier={game.tier} />

        <section
          aria-labelledby="history-heading"
          className="panel relative mt-10 overflow-hidden p-5 sm:p-7"
        >
          <span
            aria-hidden="true"
            className="marquee-bulbs pointer-events-none absolute inset-y-6 left-0 w-3 opacity-50"
          />
          <div className="sm:pl-4">
            <SectionHeading id="history-heading">{t('catalog.hub.historyTitle')}</SectionHeading>
            <RichTextStatic
              text={game.history}
              className="text-cream/90 mt-3 max-w-3xl text-base leading-relaxed"
            />
          </div>
        </section>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12">
          <section aria-labelledby="how-heading">
            <SectionHeading id="how-heading">{t('catalog.hub.howToPlay', { name })}</SectionHeading>
            <ol className="mt-6 space-y-6">
              {game.lesson.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="border-gold-300/50 bg-felt-950/60 text-gold-200 font-display inline-flex size-10 shrink-0 items-center justify-center rounded-full border text-lg font-bold tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-cream text-lg leading-snug font-bold sm:text-xl">
                      {step.title}
                    </h3>
                    <RichTextStatic
                      text={step.body}
                      className="text-mist mt-1.5 text-base leading-relaxed"
                    />
                    {step.tip ? (
                      <p className="text-cream/90 mt-2 text-sm leading-relaxed">
                        <strong className="text-gold-200">{t('learn.lesson.tip')}: </strong>
                        {step.tip}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="glossary-heading" className="lg:sticky lg:top-24 lg:self-start">
            <div className="panel p-5 sm:p-6">
              <SectionHeading id="glossary-heading">
                {t('catalog.hub.glossaryTitle')}
              </SectionHeading>
              <dl className="mt-4 space-y-3.5">
                {game.glossary.map((g) => (
                  <div key={g.term}>
                    <dt className="text-gold-200 font-bold">{g.term}</dt>
                    <dd className="text-mist mt-0.5 text-[0.9375rem] leading-relaxed">
                      {g.definition}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="mistakes-heading" className="panel p-5 sm:p-6">
            <SectionHeading id="mistakes-heading">{t('catalog.hub.mistakesTitle')}</SectionHeading>
            <ul className="mt-4 space-y-3">
              {game.mistakes.map((m, i) => (
                <li key={i} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                  <span
                    aria-hidden="true"
                    className="bg-velvet-600 text-cream mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full"
                  >
                    <CloseIcon size={14} />
                  </span>
                  <span className="text-cream/90">{m}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="variants-heading" className="panel p-5 sm:p-6">
            <SectionHeading id="variants-heading">{t('catalog.hub.variantsTitle')}</SectionHeading>
            <h3 className="text-gold-200 mt-4 text-sm font-bold tracking-[0.12em] uppercase">
              {t('catalog.hub.variantTaught')}
            </h3>
            <RichTextStatic
              text={game.variantTaught}
              className="text-cream/90 mt-1.5 text-[0.9375rem] leading-relaxed"
            />
            <h3 className="text-gold-200 mt-5 text-sm font-bold tracking-[0.12em] uppercase">
              {t('catalog.hub.variantsOther')}
            </h3>
            <RichTextStatic
              text={game.variants}
              className="text-cream/90 mt-1.5 text-[0.9375rem] leading-relaxed"
            />
          </section>
        </div>
      </div>
    </article>
  );
}
