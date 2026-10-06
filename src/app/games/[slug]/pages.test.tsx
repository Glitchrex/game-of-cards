/**
 * Server rendering of the game hub and its learn / try / quiz routes, on
 * fixture content (the catalog module is mocked).
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogGame } from '@/lib/content/catalog';

const fx = vi.hoisted(() => ({ games: [] as CatalogGame[] }));

vi.mock('@/lib/content/catalog', () => ({
  getAllGames: () => fx.games,
  getGame: (slug: string) => fx.games.find((g) => g.slug === slug),
}));
vi.mock('@/components/play/PracticeHand', () => ({
  PracticeHand: ({ slug, gameName, tips }: { slug: string; gameName: string; tips: string[] }) => (
    <div data-testid="practice-hand-stub">{`${slug}|${gameName}|${tips.length}`}</div>
  ),
}));

import { fixtureGame } from '@/components/catalog/test-fixtures';
import HubPage, { dynamicParams, generateMetadata, generateStaticParams } from './page';
import LearnPage, { generateMetadata as learnMetadata } from './learn/page';
import TryPage, { generateMetadata as tryMetadata } from './try/page';
import QuizPage, { generateMetadata as quizMetadata } from './quiz/page';

const teenPatti = fixtureGame({
  slug: 'teen-patti',
  name: 'Teen Patti',
  aka: ['3 Patti', 'Flash'],
  country: 'India',
  countryCode: 'IN',
  region: 'south-asia',
  type: 'comparing',
  players: [2, 5],
  tier: 1,
});
const durak = fixtureGame({
  slug: 'durak',
  name: 'Durak',
  country: 'Russia',
  countryCode: 'RU',
  region: 'europe',
  type: 'shedding',
  example: {
    intro: 'A two-player hand of Durak.',
    steps: Array.from({ length: 4 }, (_, i) => ({
      narration: `Step ${i + 1} of the [[deal]].`,
      scene: { zones: [{ id: 'hand', cards: ['6H', '7S'] }], animate: 'none' },
    })),
    outro: 'Hand over.',
  },
});
fx.games.push(teenPatti, durak);

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('/games/[slug] hub', () => {
  it('prerenders every game and nothing else', () => {
    expect(generateStaticParams()).toEqual([{ slug: 'teen-patti' }, { slug: 'durak' }]);
    expect(dynamicParams).toBe(false);
  });

  it('builds title, description, canonical and Open Graph metadata', async () => {
    const meta = await generateMetadata(params('teen-patti'));
    expect(meta.title).toBe('Teen Patti — how to play');
    expect(meta.description).toBe(teenPatti.seo.description);
    expect(meta.alternates?.canonical).toBe('/games/teen-patti');
    expect(meta.openGraph).toMatchObject({
      title: 'Teen Patti — how to play',
      url: '/games/teen-patti',
      type: 'article',
    });
    expect(await generateMetadata(params('nope'))).toEqual({});
  });

  it('shares the game’s own image on Open Graph and Twitter', async () => {
    const meta = await generateMetadata(params('teen-patti'));
    const image = {
      url: '/games/teen-patti/opengraph-image',
      width: 1200,
      height: 630,
      alt: expect.stringContaining('Teen Patti'),
    };
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(image)]);
    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Teen Patti — how to play',
      images: [expect.objectContaining(image)],
    });
  });

  it('renders the hero, journey, indexable rules and JSON-LD', async () => {
    const html = renderToString(await HubPage(params('teen-patti')));
    expect(html).toMatch(/<h1[^>]*>Teen Patti<\/h1>/);
    expect(html).toContain('Also known as 3 Patti · Flash');
    expect(html).toContain('2–5 players');
    expect(html).toContain('aria-label="Difficulty 2 of 5"');
    expect(html).toContain('How to play Teen Patti');
    // Glossary terms in the rules text are bold (and the markup is gone).
    expect(html).toMatch(/<strong[^>]*>deal<\/strong>/);
    expect(html).not.toContain('[[');
    expect(html).toContain('<dt class="text-gold-200 font-bold">trick</dt>');
    expect(html).toContain('Common beginner mistakes');
    expect(html).toContain('Plenty of house rules exist.');
    // Journey: Learn, Try, Play (Tier 1), Quiz.
    for (const step of ['learn', 'try', 'play', 'quiz']) {
      expect(html).toContain(`href="/games/teen-patti/${step}"`);
    }

    const json = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)?.[1];
    expect(json).toBeTruthy();
    const data = JSON.parse(json ?? '{}');
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Game',
      name: 'Teen Patti',
      alternateName: ['3 Patti', 'Flash'],
      description: teenPatti.seo.description,
      numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5 },
      audience: { '@type': 'Audience' },
    });
  });

  it('has no Play step for Tier 2 games and 404s for unknown slugs', async () => {
    const html = renderToString(await HubPage(params('durak')));
    expect(html).not.toContain('href="/games/durak/play"');
    expect(html).toContain('href="/games/durak/quiz"');
    await expect(HubPage(params('nope'))).rejects.toThrow();
  });
});

describe('/games/[slug]/learn, /try and /quiz', () => {
  it('have their own titles and canonicals', async () => {
    expect((await learnMetadata(params('durak'))).title).toBe('Learn Durak');
    expect((await tryMetadata(params('durak'))).title).toBe('Try Durak');
    const quiz = await quizMetadata(params('durak'));
    expect(quiz.title).toBe('Durak quiz');
    expect(quiz.alternates?.canonical).toBe('/games/durak/quiz');
    // Setting openGraph on a page drops inherited images, so each page lists the game's.
    for (const meta of [
      await learnMetadata(params('durak')),
      await tryMetadata(params('durak')),
      quiz,
    ]) {
      expect(meta.openGraph?.images).toEqual([
        expect.objectContaining({ url: '/games/durak/opengraph-image' }),
      ]);
      expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
    }
  });

  it('render the lesson player and quiz with a link back to the hub', async () => {
    const learn = renderToString(await LearnPage(params('durak')));
    expect(learn).toMatch(/<h1[^>]*>Learn Durak<\/h1>/);
    expect(learn).toContain('href="/games/durak"');
    expect(learn).toContain('Lesson step 1');
    expect(learn).toContain('data-testid="lesson-next"');

    const quiz = renderToString(await QuizPage(params('durak')));
    expect(quiz).toContain('Question 1?');
    expect(quiz).toContain('data-testid="quiz-option-0"');
  });

  it('runs the coached practice hand for Tier 1 and the scripted example for Tier 2', async () => {
    const tier1 = renderToString(await TryPage(params('teen-patti')));
    expect(tier1).toContain('data-testid="practice-hand-stub"');
    expect(tier1).toContain('teen-patti|Teen Patti|3');

    const tier2 = renderToString(await TryPage(params('durak')));
    expect(tier2).not.toContain('practice-hand-stub');
    expect(tier2).toContain('Let’s play a hand of Durak together');
    expect(tier2).toContain('data-testid="example-continue"');
  });
});
