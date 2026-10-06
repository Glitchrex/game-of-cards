// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { cardName, makeDeck, removeCard, type CardCode } from '@/games/core/cards';
import { useSettings } from '@/store/settings';
import { AndarBaharBoard, type AndarBaharBoardProps } from './Board';
import {
  andarBaharEngine as E,
  DEALER,
  LEARNER,
  setupWithDeck,
  type AndarBaharState,
  type Side,
} from './engine';
import { JHATPAT_JAMUNA } from './personas';

const PERSONAS = seatPersonas([JHATPAT_JAMUNA]);

/**
 * The 7♥ joker, then Andar gets 4♣ K♦ 9♠ 2♥ 7♠ (the match, card 9) and Bahar 3♦ J♣ 5♥ 8♣;
 * the rest of the deck follows in its usual order.
 */
const FRONT: CardCode[] = ['4C', '3D', 'KD', 'JC', '9S', '5H', '2H', '8C', '7S'];

function stacked(joker: CardCode, front: readonly CardCode[]): AndarBaharState {
  let rest = removeCard(makeDeck(), joker);
  for (const c of front) rest = removeCard(rest, c);
  return setupWithDeck({ players: 2 }, [joker, ...front, ...rest]);
}

const fresh = () => stacked('7H', FRONT);
const bet = (side: Side, s = fresh()) => E.applyMove(s, { type: 'bet', side });
function deal(s: AndarBaharState, n: number): AndarBaharState {
  let out = s;
  for (let i = 0; i < n; i++) out = E.applyMove(out, { type: 'deal' });
  return out;
}

function props(state: AndarBaharState, extra: Partial<AndarBaharBoardProps> = {}) {
  const yours = E.currentPlayer(state) === LEARNER;
  return {
    state,
    human: LEARNER,
    legalMoves: yours ? E.legalMoves(state, LEARNER) : [],
    onMove: vi.fn(),
    busy: !yours,
    thinking: E.currentPlayer(state) === DEALER ? DEALER : null,
    coachMode: false,
    highlight: new Set<string>(),
    suggestedKey: null,
    personas: PERSONAS,
    over: E.isOver(state),
    ...extra,
  } satisfies AndarBaharBoardProps;
}

function renderBoard(state: AndarBaharState, extra: Partial<AndarBaharBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<AndarBaharBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

const faces = (root: ParentNode) =>
  [...root.querySelectorAll('[data-card]')].map((el) => el.getAttribute('data-card'));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  // Cards land instantly; the deal animation has its own test below.
  useSettings.setState({ motion: 'reduce' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AndarBaharBoard — the table', () => {
  it('shows the dealer, the glowing joker, two empty lanes and the face-down deck', () => {
    const { container } = renderBoard(fresh());
    const seat = screen.getByTestId('ab-dealer-seat');
    expect(within(seat).getByText('Jhatpat Jamuna')).toBeInTheDocument();
    expect(within(seat).getByText(JHATPAT_JAMUNA.tagline)).toBeInTheDocument();

    // One labelled image: everything inside it is decorative.
    const joker = screen.getByRole('img', {
      name: 'Joker: Seven of Hearts. The next Seven to turn up — any suit — wins for its side.',
    });
    expect(joker).toHaveAttribute('data-joker', '7H');
    expect(within(joker).getByText('Find another Seven')).toBeInTheDocument();

    expect(
      screen.getByRole('group', { name: 'Andar (inside), pays 0.9 to 1: no cards yet.' }),
    ).toHaveAttribute('data-count', '0');
    expect(
      screen.getByRole('group', { name: 'Bahar (outside), pays 1 to 1: no cards yet.' }),
    ).toHaveAttribute('data-count', '0');
    expect(screen.getByTestId('ab-lane-andar')).toHaveTextContent('Inside · Pays 0.9 to 1');
    expect(screen.getByTestId('ab-lane-bahar')).toHaveTextContent('Outside · Pays 1 to 1');

    expect(screen.getByRole('img', { name: 'Face-down deck: 51 cards' })).toHaveAttribute(
      'data-count',
      '51',
    );
    expect(screen.getByTestId('ab-count')).toHaveTextContent('Bet first');
    expect(screen.getByTestId('ab-next')).toHaveAttribute('data-side', 'andar');
    // Only the joker has a face on the table; nothing from the deck is in the page.
    expect(faces(container)).toEqual(['7H']);
    for (const code of FRONT) expect(container.innerHTML).not.toContain(cardName(code));
  });

  it('deals into the lanes, keeps the next card hidden and points at the next lane', () => {
    const state = deal(bet('andar'), 3);
    const next = state.stock[0]!;
    const { container } = renderBoard(state);

    const andar = screen.getByRole('group', {
      name: 'Andar (inside), pays 0.9 to 1: 2 cards — Four of Clubs and King of Diamonds. Your bet is on Andar.',
    });
    expect(andar).toHaveAttribute('data-count', '2');
    expect(andar).toHaveAttribute('data-bet', 'true');
    expect(faces(andar)).toEqual(['4C', 'KD']);
    const bahar = screen.getByRole('group', {
      name: 'Bahar (outside), pays 1 to 1: 1 card — Three of Diamonds.',
    });
    expect(bahar).toHaveAttribute('data-next', 'true');
    expect(faces(bahar)).toEqual(['3D']);

    expect(screen.getByTestId('ab-count')).toHaveTextContent('Card 3');
    expect(screen.getByTestId('ab-count')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('ab-next')).toHaveAttribute('data-side', 'bahar');
    expect(screen.getByTestId('ab-next')).toHaveTextContent('Next card goes toBahar');
    expect(screen.getByTestId('ab-stock')).toHaveAttribute('data-count', '48');
    expect(screen.getByTestId('ab-bet-chip')).toHaveAttribute('data-side', 'andar');
    expect(within(andar).getByText('Your bet: one stake on Andar.')).toHaveClass('sr-only');

    // The next card off the deck never reaches the DOM.
    expect(faces(container).sort()).toEqual(['3D', '4C', '7H', 'KD']);
    expect(container.innerHTML).not.toContain(cardName(next));
    expect(container.querySelector(`[data-card="${next}"]`)).toBeNull();
  });

  it('shows the dealer dealing (dots) while she has the move', () => {
    renderBoard(bet('bahar'));
    const seat = screen.getByTestId('ab-dealer-seat');
    expect(seat).toHaveAttribute('data-thinking', 'true');
    expect(seat).toHaveAttribute('data-active', 'true');
    expect(within(seat).getByText('Dealing')).toBeInTheDocument();
  });

  it('stamps MATCH! on the matching card and settles the bet on its lane (win)', () => {
    renderBoard(deal(bet('andar'), 9));
    const board = screen.getByTestId('ab-board');
    expect(board).toHaveAttribute('data-phase', 'over');
    expect(board).toHaveAttribute('data-winner', 'andar');
    const andar = screen.getByTestId('ab-lane-andar');
    expect(andar).toHaveAttribute('data-winner', 'true');
    expect(andar).toHaveAccessibleName(
      'Andar (inside), pays 0.9 to 1: 5 cards — Four of Clubs, King of Diamonds, Nine of Spades, ' +
        'Two of Hearts and Seven of Spades. Your bet is on Andar. Andar wins.',
    );
    const match = within(andar).getByTestId('ab-match');
    expect(match).toHaveTextContent('This card matches the joker. Match!');
    expect(match.closest('[data-match]')?.querySelector('[data-card]')).toHaveAttribute(
      'data-card',
      '7S',
    );
    expect(within(andar).getByTestId('ab-outcome')).toHaveAttribute('data-outcome', 'win');
    expect(within(andar).getByTestId('ab-outcome')).toHaveTextContent('Result: You win');
    expect(screen.getByTestId('ab-bet-chip')).toHaveAttribute('data-outcome', 'win');
    expect(screen.getByTestId('ab-lane-bahar')).not.toHaveAttribute('data-winner');
    expect(screen.getByTestId('ab-count')).toHaveTextContent('Match on card 9!');
    expect(screen.getByTestId('ab-next')).not.toHaveAttribute('data-side');
    expect(screen.getAllByTestId('ab-match')).toHaveLength(1);
  });

  it('collects a losing bet', () => {
    renderBoard(deal(bet('bahar'), 9));
    const bahar = screen.getByTestId('ab-lane-bahar');
    expect(within(bahar).getByTestId('ab-outcome')).toHaveAttribute('data-outcome', 'loss');
    expect(within(bahar).getByTestId('ab-outcome')).toHaveTextContent('Result: You lose');
    expect(within(screen.getByTestId('ab-lane-andar')).getByTestId('ab-match')).toBeVisible();
    expect(within(screen.getByTestId('ab-lane-andar')).queryByTestId('ab-outcome')).toBeNull();
  });

  it('wraps 25 cards in one lane without losing any', () => {
    // A joker whose matches are the last three cards: the deal runs to card 49.
    const deck = makeDeck();
    const kings = deck.filter((c) => c.startsWith('K') && c !== 'KS');
    const front = removeCard(deck, 'KS').filter((c) => !c.startsWith('K'));
    const state = deal(bet('andar', stacked('KS', [...front, ...kings])), 49);
    expect(E.isOver(state)).toBe(true);
    renderBoard(state);
    expect(screen.getByTestId('ab-lane-andar')).toHaveAttribute('data-count', '25');
    expect(screen.getByTestId('ab-lane-bahar')).toHaveAttribute('data-count', '24');
    expect(faces(screen.getByTestId('ab-lane-andar'))).toHaveLength(25);
    expect(screen.getByTestId('ab-count')).toHaveTextContent('Match on card 49!');
  });
});

describe('AndarBaharBoard — betting', () => {
  it('has two big bet buttons that call onMove with the side', () => {
    const { onMove } = renderBoard(fresh());
    const group = screen.getByRole('group', { name: 'Place your bet' });
    const andar = within(group).getByRole('button', {
      name: 'Bet on Andar',
    });
    const bahar = within(group).getByTestId('ab-bahar');
    expect(andar).toHaveAttribute('data-testid', 'ab-andar');
    expect(andar).toHaveAccessibleDescription('Inside · pays 0.9 to 1');
    expect(bahar).toHaveAccessibleDescription('Outside · pays 1 to 1');
    expect(andar).not.toHaveAttribute('aria-disabled');
    expect(andar).toHaveAttribute('data-legal', 'true');
    fireEvent.click(andar);
    expect(onMove).toHaveBeenLastCalledWith({ type: 'bet', side: 'andar' });
    fireEvent.click(bahar);
    expect(onMove).toHaveBeenLastCalledWith({ type: 'bet', side: 'bahar' });
  });

  it('plays from the keyboard: Tab to a button, arrows to switch, Enter or Space to bet', async () => {
    const user = userEvent.setup();
    const { onMove } = renderBoard(fresh());
    await user.tab();
    expect(screen.getByTestId('ab-andar')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('ab-bahar')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onMove).toHaveBeenLastCalledWith({ type: 'bet', side: 'bahar' });
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('ab-andar')).toHaveFocus();
    await user.keyboard(' ');
    expect(onMove).toHaveBeenLastCalledWith({ type: 'bet', side: 'andar' });
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('ab-bahar')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByTestId('ab-andar')).toHaveFocus();
  });

  it('bets with the A / B shortcuts from anywhere (either case) and lists them', () => {
    const { onMove } = renderBoard(fresh());
    expect(screen.getByTestId('ab-andar')).toHaveAttribute('aria-keyshortcuts', 'A');
    expect(screen.getByTestId('ab-bahar')).toHaveAttribute('aria-keyshortcuts', 'B');
    expect(screen.getByTestId('ab-keys')).toHaveTextContent('Keys:ABet on AndarBBet on Bahar');
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'bet', side: 'andar' });
    fireEvent.keyDown(document.body, { key: 'B' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'bet', side: 'bahar' });
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('leaves shortcuts alone while typing, with modifiers, on repeat or in another dialog', () => {
    const p = props(fresh());
    render(
      <>
        <AndarBaharBoard {...p} />
        <input aria-label="Comment" />
        <div role="dialog" aria-label="Feedback">
          <button type="button">Send</button>
        </div>
      </>,
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Comment' }), { key: 'a' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Send' }), { key: 'b' });
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'b', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'a', altKey: true });
    fireEvent.keyDown(document.body, { key: 'b', repeat: true });
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(p.onMove).not.toHaveBeenCalled();
  });

  it('ignores presses while the dealer deals, keeps focus and marks the chosen side', () => {
    const { onMove } = renderBoard(deal(bet('bahar'), 2));
    const andar = screen.getByTestId('ab-andar');
    const bahar = screen.getByTestId('ab-bahar');
    expect(bahar).toHaveAttribute('data-chosen', 'true');
    expect(andar).not.toHaveAttribute('data-chosen');
    for (const b of [andar, bahar]) {
      expect(b).toHaveAttribute('aria-disabled', 'true');
      expect(b).not.toHaveAttribute('disabled');
    }
    expect(bahar).toHaveAccessibleDescription(
      'Outside · pays 1 to 1 You bet on this side. Jhatpat Jamuna is dealing — just watch where the match lands.',
    );
    bahar.focus();
    fireEvent.click(bahar);
    fireEvent.click(andar);
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(onMove).not.toHaveBeenCalled();
    expect(bahar).toHaveFocus();
  });

  it('says the deal is over once it is', () => {
    renderBoard(deal(bet('andar'), 9));
    expect(screen.getByTestId('ab-andar')).toHaveAccessibleDescription(
      'Inside · pays 0.9 to 1 You bet on this side. This deal is over.',
    );
  });

  it('keeps the buttons’ extra descriptions out of the reading order', () => {
    renderBoard(deal(bet('andar'), 9), { coachMode: true, suggestedKey: 'bet:bahar' });
    // Read through aria-describedby only — not as stray lines after the buttons.
    for (const text of ['This deal is over.', 'You bet on this side.', 'The coach’s pick.']) {
      expect(screen.getByText(text)).not.toBeVisible();
    }
    expect(screen.getByTestId('ab-andar')).toHaveAccessibleDescription(
      'Inside · pays 0.9 to 1 You bet on this side. This deal is over.',
    );
  });
});

describe('AndarBaharBoard — coach mode', () => {
  it('makes both bets glow and the suggested one pulse (coach mode only)', () => {
    const state = fresh();
    const highlight = new Set(E.legalMoves(state, LEARNER).map((m) => E.moveKey(m)));
    const { rerender } = renderBoard(state, { coachMode: true, highlight });
    expect(screen.getByTestId('ab-andar')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('ab-bahar')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.queryByTestId('ab-suggested-ring')).toBeNull();

    const suggestedKey = E.moveKey(E.coach(state, LEARNER).suggestion as never);
    expect(suggestedKey).toBe('bet:andar');
    rerender(<AndarBaharBoard {...props(state, { coachMode: true, highlight, suggestedKey })} />);
    const andar = screen.getByTestId('ab-andar');
    expect(andar).toHaveAttribute('data-suggested', 'true');
    expect(andar).toHaveTextContent('Pro pick');
    expect(andar).toHaveAccessibleDescription('Inside · pays 0.9 to 1 The coach’s pick.');
    expect(screen.getByTestId('ab-bahar')).not.toHaveAttribute('data-suggested');
    expect(screen.getAllByTestId('ab-suggested-ring')).toHaveLength(1);

    rerender(<AndarBaharBoard {...props(state, { highlight })} />);
    expect(screen.getByTestId('ab-andar')).not.toHaveAttribute('data-highlighted');
  });
});

describe('AndarBaharBoard — motion', () => {
  it('flies each new card in face down and turns it over as it travels', () => {
    vi.useFakeTimers();
    useSettings.setState({ motion: 'full' });
    const start = bet('andar');
    const { rerender, props: p } = renderBoard(start);
    const one = deal(start, 1);
    rerender(<AndarBaharBoard {...p} {...props(one)} />);
    const andar = screen.getByTestId('ab-lane-andar');
    expect(andar.querySelectorAll('[data-face-down]')).toHaveLength(1);
    expect(faces(andar)).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(faces(andar)).toEqual(['4C']);
  });

  it('turns up a fresh table (no cards) when a new deal starts', () => {
    const over = deal(bet('andar'), 9);
    const { rerender, props: p } = renderBoard(over);
    expect(screen.getByTestId('ab-lane-andar')).toHaveAttribute('data-count', '5');
    const next = stacked('2S', FRONT);
    rerender(<AndarBaharBoard {...p} {...props(next)} />);
    expect(screen.getByTestId('ab-joker')).toHaveAttribute('data-joker', '2S');
    expect(screen.getByTestId('ab-lane-andar')).toHaveAttribute('data-count', '0');
    expect(screen.queryByTestId('ab-outcome')).toBeNull();
    expect(screen.getByTestId('ab-board')).toHaveAttribute('data-phase', 'bet');
  });
});
