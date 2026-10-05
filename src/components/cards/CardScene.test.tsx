// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { SceneSchema, type Scene } from '@/lib/content/schema';
import { CardScene } from './CardScene';
import { describeScene, sceneHash } from './describe';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const SCENE: Scene = SceneSchema.parse({
  zones: [
    { id: 'dealer', label: 'Dealer', cards: ['KS', '7D'], layout: 'row', faceDown: [1] },
    { id: 'hand', label: 'Your hand', cards: ['AS', 'KH'], layout: 'fan', highlight: [1] },
    { id: 'tab', cards: ['QH', 'JC', 'TD'], layout: 'cascade' },
    {
      id: 'stock',
      label: 'Stock',
      cards: ['2C', '3C', '4C', '5C', '6C', '7C', '8C'],
      layout: 'stack',
    },
    { id: 'grid', label: 'Grid', cards: ['2H', '3H', '4H', '5H', '6H'], layout: 'grid' },
  ],
  caption: 'The dealer shows a King.',
});

describe('describeScene', () => {
  it('lists every zone and card, marking highlights and face-down cards', () => {
    expect(describeScene(SCENE)).toEqual([
      'Dealer: King of Spades, face-down card',
      'Your hand: Ace of Spades, King of Hearts (highlighted)',
      'Group 3: Queen of Hearts, Jack of Clubs, Ten of Diamonds',
      'Stock: Two of Clubs, Three of Clubs, Four of Clubs, Five of Clubs, Six of Clubs, Seven of Clubs, Eight of Clubs',
      'Grid: Two of Hearts, Three of Hearts, Four of Hearts, Five of Hearts, Six of Hearts',
    ]);
  });

  it('calls a single unlabeled zone "Cards" and handles empty zones', () => {
    expect(describeScene({ zones: [{ id: 'z', cards: [] }] })).toEqual(['Cards: no cards']);
  });
});

describe('sceneHash', () => {
  it('is stable for equal scenes and changes when the scene changes', () => {
    const copy = JSON.parse(JSON.stringify(SCENE)) as Scene;
    expect(sceneHash(copy)).toBe(sceneHash(SCENE));
    const changed = { ...SCENE, zones: [{ id: 'x', cards: ['AS'] }] };
    expect(sceneHash(changed)).not.toBe(sceneHash(SCENE));
  });
});

describe('CardScene', () => {
  it('renders every zone, card, the caption and the text description', () => {
    render(<CardScene scene={SCENE} data-testid="scene" />);
    for (const zone of SCENE.zones) {
      // Stacks only draw their top few cards; every other layout draws them all.
      const drawn = zone.layout === 'stack' ? Math.min(zone.cards.length, 6) : zone.cards.length;
      const offset = zone.cards.length - drawn;
      for (let i = offset; i < zone.cards.length; i++) {
        expect(screen.getByTestId(`scene-card-${zone.id}-${i}`)).toBeInTheDocument();
      }
    }
    expect(screen.getByText('Dealer')).toBeInTheDocument();
    expect(screen.getByText('The dealer shows a King.')).toBeInTheDocument();

    const description = screen.getByTestId('scene-description');
    const items = within(description).getAllByRole('listitem');
    expect(items).toHaveLength(SCENE.zones.length);
    expect(items[1]).toHaveTextContent('Your hand: Ace of Spades, King of Hearts (highlighted)');
    expect(items[0]).toHaveTextContent('Dealer: King of Spades, face-down card');
  });

  it('marks highlighted and face-down cards visually', () => {
    render(<CardScene scene={SCENE} />);
    expect(screen.getByTestId('scene-card-hand-1')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('scene-card-dealer-1')).toHaveAttribute('data-face-down', 'true');
    expect(screen.getByTestId('scene-card-dealer-0')).toHaveAttribute('data-card', 'KS');
  });

  it('keeps the decorative table out of the accessibility tree when not interactive', () => {
    render(<CardScene scene={SCENE} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('accepts content-file scenes without defaults and can hide the caption', () => {
    render(
      <CardScene
        showCaption={false}
        scene={{ zones: [{ id: 'z', label: 'Pile', cards: ['AS', '2S'] }], caption: 'Hidden' }}
      />,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.getByText('Pile: Ace of Spades, Two of Spades')).toBeInTheDocument();
  });

  it('reports clicks on interactive scenes', async () => {
    const user = userEvent.setup();
    const onCardClick = vi.fn();
    render(<CardScene scene={SCENE} onCardClick={onCardClick} />);
    const hand = screen.getByRole('group', { name: 'Your hand' });
    await user.click(within(hand).getByRole('button', { name: 'King of Hearts' }));
    expect(onCardClick).toHaveBeenCalledWith('hand', 1);
  });

  it('flips cards face-up in flip scenes', async () => {
    render(
      <CardScene
        scene={{
          animate: 'flip',
          zones: [{ id: 'r', cards: ['TH', 'JH'], layout: 'row', faceDown: [1] }],
        }}
      />,
    );
    expect(screen.getByTestId('scene-card-r-0')).toHaveAttribute('data-face-down', 'true');
    await waitFor(() =>
      expect(screen.getByTestId('scene-card-r-0')).not.toHaveAttribute('data-face-down'),
    );
    // Cards listed in faceDown stay face-down.
    expect(screen.getByTestId('scene-card-r-1')).toHaveAttribute('data-face-down', 'true');
  });

  it('re-renders from scratch when the scene changes', () => {
    const { rerender } = render(<CardScene scene={SCENE} />);
    rerender(<CardScene scene={{ zones: [{ id: 'new', label: 'New', cards: ['9S'] }] }} />);
    expect(screen.queryByTestId('scene-card-dealer-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('scene-card-new-0')).toHaveAttribute('data-card', '9S');
  });
});
