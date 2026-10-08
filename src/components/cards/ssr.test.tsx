// @vitest-environment jsdom
/**
 * Server rendering + hydration: the card components must render on the server
 * without touching `window`, keep hidden cards out of the HTML, and hydrate
 * without mismatches (persisted settings are only applied after hydration).
 */
import { type ReactNode } from 'react';
import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { MotionGlobalConfig } from 'motion/react';
import { CardScene } from './CardScene';
import { DeckShowcase } from './DeckShowcase';
import { Hand } from './Hand';
import { Pile } from './Pile';
import { PlayingCard } from './PlayingCard';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const CASES: [string, ReactNode][] = [
  ['face-up card', <PlayingCard key="a" code="QH" highlighted />],
  ['face-down button', <PlayingCard key="b" code="QH" faceDown onClick={() => {}} />],
  [
    'interactive hand',
    <Hand key="c" cards={['AS', '7H', 'QC']} label="Yours" onActivate={() => {}} />,
  ],
  ['opponent hand', <Hand key="d" cards={['AS', '7H', 'QC']} label="Theirs" faceDown />],
  [
    'pile',
    <Pile key="e" count={12} label="Stock" topCard="9S" faceUp={false} onClick={() => {}} />,
  ],
  [
    'scene',
    <CardScene
      key="f"
      scene={{
        animate: 'deal',
        zones: [
          { id: 'h', label: 'Hand', cards: ['AS', 'KH'], layout: 'fan' },
          { id: 'd', label: 'Dealer', cards: ['2C', '9D'], faceDown: [1] },
        ],
      }}
    />,
  ],
  [
    'flip scene',
    <CardScene key="g" scene={{ animate: 'flip', zones: [{ id: 'r', cards: ['TH'] }] }} />,
  ],
  ['deck showcase', <DeckShowcase key="h" startDelayMs={60_000} />],
];

describe('card components on the server', () => {
  it.each(CASES)('%s renders to HTML and hydrates cleanly', async (_name, element) => {
    const html = renderToString(element);
    expect(html.length).toBeGreaterThan(0);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: unknown[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });
    try {
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => errors.push(error),
        });
      });
      expect(errors).toEqual([]);
      act(() => root?.unmount());
    } finally {
      consoleError.mockRestore();
      container.remove();
    }
  });

  it('keeps deal scenes visible when JavaScript never runs', () => {
    const deal = renderToString(<CardScene scene={{ zones: [{ id: 'z', cards: ['AS'] }] }} />);
    expect(deal).toContain('<noscript><style>[data-deal]{opacity:1!important}</style></noscript>');
    const still = renderToString(
      <CardScene scene={{ animate: 'none', zones: [{ id: 'z', cards: ['AS'] }] }} />,
    );
    expect(still).not.toContain('noscript');
  });

  it('never puts face-down cards into the server HTML', () => {
    const html = renderToString(
      <>
        <PlayingCard code="QH" faceDown />
        <Hand cards={['KS', 'JD']} label="Theirs" faceDown />
        <Pile count={3} label="Stock" topCard="8C" faceUp={false} />
        <CardScene scene={{ animate: 'flip', zones: [{ id: 'z', cards: ['7S'] }] }} />
      </>,
    );
    for (const code of ['QH', 'KS', 'JD', '8C', '7S']) expect(html).not.toContain(code);
    for (const name of ['Queen of Hearts', 'King of Spades', 'Eight of Clubs']) {
      expect(html).not.toContain(name);
    }
  });
});
