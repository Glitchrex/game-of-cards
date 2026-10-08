// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { useSettings } from '@/store/settings';
import { BlackjackBoard, type BlackjackBoardProps } from './Board';
import { blackjackEngine as E, DEALER, LEARNER, type BlackjackState } from './engine';
import { DEALER_SITARA } from './personas';
import { deal, finishDealer, play } from './test-helpers';

const PERSONAS = seatPersonas([DEALER_SITARA]);

function props(state: BlackjackState, extra: Partial<BlackjackBoardProps> = {}) {
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
  } satisfies BlackjackBoardProps;
}

function renderBoard(state: BlackjackState, extra: Partial<BlackjackBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<BlackjackBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

/** Hard 16 (9♥ 7♣) against a King with the 6♦ in the hole; the 5♠ is next in the shoe. */
const sixteenVsKing = () => deal(['9H', '7C'], ['KS', '6D'], ['5S']);

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

describe('BlackjackBoard — the table', () => {
  it('shows the dealer persona, the upcard and a face-down hole card that is not in the DOM', () => {
    const { container } = renderBoard(sixteenVsKing());

    const seat = screen.getByTestId('bj-dealer-seat');
    expect(within(seat).getByText('Dealer Sitara')).toBeInTheDocument();
    expect(within(seat).getByText(DEALER_SITARA.tagline)).toBeInTheDocument();

    const dealerHand = screen.getByRole('group', {
      name: 'Dealer’s hand: King of Spades and a face-down card',
    });
    expect(dealerHand).toHaveAttribute('data-hole', 'hidden');
    expect(dealerHand.querySelectorAll('[data-face-down]')).toHaveLength(1);
    // Only the dealer's upcard and the learner's cards have faces on the table.
    const faces = [...container.querySelectorAll('[data-card]')].map((el) =>
      el.getAttribute('data-card'),
    );
    expect(faces.sort()).toEqual(['7C', '9H', 'KS']);
    // The hole card (6♦) and the next card in the shoe (5♠) never reach the DOM.
    expect(container.innerHTML).not.toMatch(/6D|Six of Diamonds|5S|Five of Spades/);
    expect(screen.getByTestId('bj-dealer-total')).toHaveTextContent('Shows 10');
    expect(screen.getByTestId('bj-dealer-total')).toHaveAttribute('data-total', '10');
  });

  it('turns the hole card over once it is revealed and totals the whole dealer hand', () => {
    const state = E.applyMove(play(sixteenVsKing(), 'stand'), { type: 'reveal' });
    const { container } = renderBoard(state);

    expect(
      screen.getByRole('group', { name: 'Dealer’s hand: King of Spades and Six of Diamonds' }),
    ).toHaveAttribute('data-hole', 'revealed');
    expect(container.querySelector('[data-card="6D"]')).not.toBeNull();
    expect(screen.getByTestId('bj-dealer-total')).toHaveTextContent('Hard 16');
    // The dealer is drawing: their seat glows and every action waits.
    expect(screen.getByTestId('bj-dealer-seat')).toHaveAttribute('data-thinking');
    // House rules make every dealer move forced: she "plays" rather than "thinks".
    expect(within(screen.getByTestId('bj-dealer-seat')).getByText('Playing')).toBeInTheDocument();
    expect(screen.getByTestId('bj-hit')).toHaveAttribute('aria-disabled', 'true');
  });

  it('says "Shows an Ace" for an Ace upcard', () => {
    renderBoard(deal(['TS', '7H'], ['AC', '5D']));
    expect(screen.getByTestId('bj-dealer-total')).toHaveTextContent('Shows an Ace');
  });

  it('prints the table rules on the felt (and reads them to screen readers)', () => {
    renderBoard(sixteenVsKing());
    const felt = screen.getByTestId('bj-felt-print');
    expect(felt).toHaveTextContent('Blackjack pays 3 to 2');
    expect(felt).toHaveTextContent('Dealer stands on all 17s');
    expect(
      screen.getByText('Table rules: the dealer stands on all 17s, and Blackjack pays 3 to 2.'),
    ).toHaveClass('sr-only');
  });

  it('labels the learner zone and words totals as hard, soft or plain', () => {
    const { unmount } = renderBoard(sixteenVsKing());
    expect(
      screen.getByRole('group', { name: 'Your hand: Nine of Hearts and Seven of Clubs' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('Hard 16');
    unmount();

    const soft = renderBoard(deal(['AH', '6C'], ['9D', '8C']));
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('Soft 17');
    expect(screen.getByTestId('bj-player-total')).toHaveAttribute('data-soft', 'true');
    soft.unmount();

    renderBoard(deal(['5H', '3C'], ['9D', '8C']));
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent(/^8$/);
  });

  it('shows BUST and BLACKJACK badges and stamps each hand with its result', () => {
    const { unmount } = renderBoard(
      finishDealer(play(deal(['TS', '6H'], ['7D', 'TC'], ['KS']), 'hit')),
    );
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent(/^26$/);
    expect(screen.getByTestId('bj-player-total')).toHaveAttribute('data-bust', 'true');
    expect(screen.getByTestId('bj-badge-bust')).toHaveTextContent('Bust');
    expect(screen.getByTestId('bj-outcome')).toHaveAttribute('data-outcome', 'loss');
    expect(screen.getByTestId('bj-outcome')).toHaveTextContent('Result: Lose');
    unmount();

    renderBoard(finishDealer(deal(['AS', 'KH'], ['9D', '8C'])));
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('21');
    expect(screen.getByTestId('bj-badge-blackjack')).toHaveTextContent('Blackjack');
    expect(screen.getByTestId('bj-outcome')).toHaveAttribute('data-outcome', 'blackjack');
    expect(screen.getByTestId('bj-dealer-total')).toHaveTextContent('Hard 17');
  });

  it('shows a dealer bust on the dealer side', () => {
    renderBoard(finishDealer(play(deal(['TS', '8H'], ['6C', 'TD'], ['9S']), 'stand')));
    const dealerHand = screen.getByTestId('bj-dealer-hand');
    expect(within(dealerHand).getByTestId('bj-dealer-total')).toHaveTextContent(/^25$/);
    expect(within(dealerHand).getByTestId('bj-badge-bust')).toBeInTheDocument();
    expect(screen.getByTestId('bj-outcome')).toHaveAttribute('data-outcome', 'win');
  });

  it('stacks two chips (×2) on a doubled hand', () => {
    renderBoard(play(deal(['6S', '5H'], ['9D', '8C'], ['KS']), 'double'));
    const bet = screen.getByTestId('bj-bet');
    expect(bet).toHaveAttribute('data-bet', '2');
    expect(bet).toHaveTextContent('×2');
    expect(bet).toHaveTextContent('2 bets riding (doubled)');
  });

  it('renders both hands after a split, raising the hand being played', () => {
    const split = play(deal(['8S', '8H'], ['6C', 'TD'], ['3C', 'KH', '9D']), 'split');
    const { rerender, props: p } = renderBoard(split);

    const first = screen.getByRole('group', {
      name: 'Your first hand: Eight of Spades and Three of Clubs',
    });
    const second = screen.getByRole('group', {
      name: 'Your second hand: Eight of Hearts and King of Hearts',
    });
    expect(screen.getByRole('group', { name: 'Your hands' })).toContainElement(first);
    expect(first).toHaveAttribute('data-active', 'true');
    expect(second).not.toHaveAttribute('data-active');
    expect(within(first).getByText('Playing')).toBeInTheDocument();
    expect(within(second).getByText('Up next')).toBeInTheDocument();
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('11');
    expect(screen.getByTestId('bj-player-total-2')).toHaveTextContent('Hard 18');

    // Hit the first hand (9♦ → 20) and stand: the second hand is up.
    const next = play(split, 'hit', 'stand');
    rerender(<BlackjackBoard {...p} {...props(next)} />);
    expect(screen.getByTestId('bj-hand-0')).not.toHaveAttribute('data-active');
    expect(screen.getByTestId('bj-hand-1')).toHaveAttribute('data-active', 'true');
    expect(within(screen.getByTestId('bj-hand-0')).getByText('Done')).toBeInTheDocument();
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('Hard 20');
  });

  it('reads 21 after splitting Aces as a plain 21, not a Blackjack', () => {
    renderBoard(play(deal(['AS', 'AH'], ['6C', 'TD'], ['KC', '5H']), 'split'));
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('21');
    expect(screen.getByTestId('bj-player-total')).not.toHaveAttribute('data-blackjack');
    expect(screen.queryByTestId('bj-badge-blackjack')).not.toBeInTheDocument();
  });
});

describe('BlackjackBoard — actions', () => {
  it('has four large, always-visible buttons that call onMove', () => {
    const { onMove } = renderBoard(sixteenVsKing());
    const group = screen.getByRole('group', { name: 'Your moves' });
    for (const [id, type] of [
      ['bj-hit', 'hit'],
      ['bj-stand', 'stand'],
      ['bj-double', 'double'],
    ] as const) {
      const button = within(group).getByTestId(id);
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute('aria-disabled');
      fireEvent.click(button);
      expect(onMove).toHaveBeenLastCalledWith({ type });
    }
    expect(screen.getByRole('button', { name: 'Hit' })).toHaveAccessibleDescription('Take a card');
  });

  it('keeps an unavailable action operable so the coach can explain it', () => {
    const { onMove } = renderBoard(sixteenVsKing());
    const split = screen.getByTestId('bj-split');
    // Not a pair: Split is not legal, looks secondary, but stays a focusable, working button.
    expect(split).not.toHaveAttribute('data-legal');
    expect(split).toHaveAttribute('aria-disabled', 'true');
    expect(split).not.toHaveAttribute('disabled');
    expect(split).toHaveAccessibleDescription(
      'Pairs only Not available right now — press it and the coach explains why.',
    );
    split.focus();
    expect(split).toHaveFocus();
    fireEvent.click(split);
    expect(onMove).toHaveBeenCalledWith({ type: 'split' });
  });

  it('ignores presses while busy but keeps the buttons focusable', () => {
    const state = play(sixteenVsKing(), 'stand');
    const { onMove } = renderBoard(state);
    const stand = screen.getByTestId('bj-stand');
    expect(stand).toHaveAttribute('aria-disabled', 'true');
    expect(stand).not.toHaveAttribute('disabled');
    expect(stand).toHaveAccessibleDescription('Stop here Wait — Dealer Sitara is playing.');
    fireEvent.click(stand);
    fireEvent.keyDown(document.body, { key: 'h' });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('announces H / S / D / P shortcuts and shows a legend', () => {
    renderBoard(sixteenVsKing());
    expect(screen.getByTestId('bj-hit')).toHaveAttribute('aria-keyshortcuts', 'H');
    expect(screen.getByTestId('bj-stand')).toHaveAttribute('aria-keyshortcuts', 'S');
    expect(screen.getByTestId('bj-double')).toHaveAttribute('aria-keyshortcuts', 'D');
    expect(screen.getByTestId('bj-split')).toHaveAttribute('aria-keyshortcuts', 'P');
    expect(screen.getByTestId('bj-keys')).toHaveTextContent(
      'Keyboard shortcuts:HHitSStandDDoublePSplit',
    );
  });

  it('plays the shortcut keys from anywhere on the page (either case)', () => {
    const { onMove } = renderBoard(sixteenVsKing());
    fireEvent.keyDown(document.body, { key: 'h' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'hit' });
    fireEvent.keyDown(document.body, { key: 'S' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'stand' });
    fireEvent.keyDown(screen.getByTestId('bj-hit'), { key: 'd' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'double' });
    fireEvent.keyDown(document.body, { key: 'p' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'split' });
    expect(onMove).toHaveBeenCalledTimes(4);
  });

  it('leaves shortcuts alone while typing, with modifiers, on repeat or in another dialog', () => {
    const p = props(sixteenVsKing());
    render(
      <>
        <BlackjackBoard {...p} />
        <input aria-label="Comment" />
        <textarea aria-label="Message" />
        <div role="dialog" aria-label="Feedback">
          <button type="button">Send</button>
        </div>
      </>,
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Comment' }), { key: 'h' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: 's' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Send' }), { key: 'h' });
    fireEvent.keyDown(document.body, { key: 'h', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 's', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'd', altKey: true });
    fireEvent.keyDown(document.body, { key: 'h', repeat: true });
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(p.onMove).not.toHaveBeenCalled();
  });
});

describe('BlackjackBoard — coach mode', () => {
  it('makes legal actions glow and the suggested one pulse (coach mode only)', () => {
    const state = sixteenVsKing();
    const legal = E.legalMoves(state, LEARNER);
    const highlight = new Set(legal.map((m) => E.moveKey(m)));
    const { rerender } = renderBoard(state, { coachMode: true, highlight });

    expect(screen.getByTestId('bj-hit')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('bj-stand')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('bj-double')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('bj-split')).not.toHaveAttribute('data-highlighted');
    expect(screen.queryByTestId('bj-suggested-ring')).not.toBeInTheDocument();

    rerender(
      <BlackjackBoard {...props(state, { coachMode: true, highlight, suggestedKey: 'hit' })} />,
    );
    const hit = screen.getByTestId('bj-hit');
    expect(hit).toHaveAttribute('data-suggested', 'true');
    expect(within(hit).getByTestId('bj-suggested-ring')).toBeInTheDocument();
    expect(hit).toHaveAccessibleDescription('Take a card The coach’s pick');
    expect(screen.getByTestId('bj-stand')).not.toHaveAttribute('data-suggested');

    // Outside coach mode nothing glows, even if a highlight set is passed.
    rerender(<BlackjackBoard {...props(state, { coachMode: false, highlight })} />);
    expect(screen.getByTestId('bj-hit')).not.toHaveAttribute('data-highlighted');
  });
});

describe('BlackjackBoard — dealing', () => {
  it('deals from the shoe face down, turns cards up as they land and keeps the hole card down', async () => {
    useSettings.setState({ motion: 'full' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { container } = renderBoard(sixteenVsKing());

    // Mid-deal: every card is still face down.
    expect(container.querySelectorAll('[data-card]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-face-down]')).toHaveLength(4);
    // The labels already describe the table, so screen readers never wait for the animation.
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('Hard 16');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    const faces = [...container.querySelectorAll('[data-card]')].map((el) =>
      el.getAttribute('data-card'),
    );
    expect(faces.sort()).toEqual(['7C', '9H', 'KS']);
    expect(screen.getByTestId('bj-dealer-hand').querySelectorAll('[data-face-down]')).toHaveLength(
      1,
    );
  });

  it('deals a new card when the learner hits', async () => {
    const state = sixteenVsKing();
    const { rerender, props: p } = renderBoard(state);
    rerender(<BlackjackBoard {...p} {...props(play(state, 'hit'))} />);
    expect(
      screen.getByRole('group', {
        name: 'Your hand: Nine of Hearts, Seven of Clubs and Five of Spades',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('21');
  });
});
