// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { useSettings } from '@/store/settings';
import { TexasHoldemBoard, type TexasHoldemBoardProps } from './Board';
import {
  texasHoldemEngine as E,
  evaluateHand,
  type TexasHoldemMove,
  type TexasHoldemState,
} from './engine';
import { holdemBots } from './personas';
import { A, B, C, checkDown, deal, F, play, R, X } from './test-helpers';

const PERSONAS = seatPersonas(holdemBots(4));
const [, MOTI, LAKSHMI, BUNTY] = PERSONAS;

function props(state: TexasHoldemState, extra: Partial<TexasHoldemBoardProps> = {}) {
  const current = E.currentPlayer(state);
  const yours = current === 0;
  const onMove = vi.fn<(move: TexasHoldemMove) => void>();
  return {
    state,
    human: 0,
    legalMoves: yours ? E.legalMoves(state, 0) : [],
    busy: !yours,
    thinking: current !== null && current !== 0 ? current : null,
    coachMode: false,
    highlight: new Set<string>(),
    suggestedKey: null,
    personas: PERSONAS,
    over: E.isOver(state),
    ...extra,
    onMove,
  } satisfies TexasHoldemBoardProps;
}

function renderBoard(state: TexasHoldemState, extra: Partial<TexasHoldemBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<TexasHoldemBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

/** Coach mode, as PracticeHand renders it: every legal move's key is highlighted. */
function coached(state: TexasHoldemState, suggestedKey: string | null = null) {
  return {
    coachMode: true,
    highlight: new Set(E.legalMoves(state, 0).map((m) => E.moveKey(m))),
    suggestedKey,
  };
}

/**
 * Four seats, the button on seat 1 (Moti): Lakshmi posts the small blind, Bunty the big
 * blind, and the learner (A♠ K♠) is first to act, facing the 2-chip big blind.
 */
const HANDS = ['AS KS', 'QD QC', '7H 2C', '9S 9D'];
const BOARD = '8S QS KC 8D 5S';
const opening = () => deal({ players: 4, button: 1, hands: HANDS, board: BOARD });
const SECRETS: CardCode[] = ['QD', 'QC', '7H', '2C', '9S', '9D'];

const faces = (root: ParentNode) =>
  [...root.querySelectorAll('[data-card]')].map((el) => el.getAttribute('data-card'));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  // Cards land instantly; flights are covered by the integration test with full motion.
  useSettings.setState({ motion: 'reduce' });
});

describe('TexasHoldemBoard — the table', () => {
  it('seats the bots clockwise with stacks, blinds, bets and the dealer button', () => {
    renderBoard(opening());
    const names = [1, 2, 3].map(
      (s) => within(screen.getByTestId(`holdem-seat-${s}`)).getAllByText(/\w/)[0]?.textContent,
    );
    expect(names).toEqual([MOTI?.name, LAKSHMI?.name, BUNTY?.name]);
    expect(screen.getByTestId('holdem-dealer-button')).toHaveAttribute('data-seat', '1');
    expect(within(screen.getByTestId('holdem-seat-2')).getByText('Small blind')).toHaveClass(
      'sr-only',
    );
    expect(within(screen.getByTestId('holdem-seat-3')).getByText('Big blind')).toHaveClass(
      'sr-only',
    );
    expect(screen.getByTestId('holdem-stack-2')).toHaveAttribute('data-stack', '99');
    expect(screen.getByTestId('holdem-stack-3')).toHaveAttribute('data-stack', '98');
    expect(screen.getByTestId('holdem-stack-0')).toHaveTextContent('Stack: 100 chips');
    expect(screen.getByTestId('holdem-bet-2')).toHaveAttribute('data-bet', '1');
    expect(screen.getByTestId('holdem-bet-3')).toHaveAttribute('data-bet', '2');
    expect(screen.getByTestId('holdem-bet-3')).toHaveTextContent('Bet this round: 2 chips');
    expect(screen.queryByTestId('holdem-bet-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('holdem-last-3')).toHaveTextContent('Big blind 2');
    expect(screen.getByTestId('holdem-pot')).toHaveAttribute('data-total', '3');
    expect(screen.getByTestId('holdem-pot')).toHaveTextContent('Pot: 3 chips');
    expect(screen.getByTestId('holdem-street')).toHaveTextContent('Before the flop');
    expect(screen.getByTestId('holdem-seat-0')).toHaveAttribute('data-active', 'true');
  });

  it('shows only the learner’s cards: opponents’ hole cards and the deck never reach the DOM', () => {
    const state = opening();
    const { container } = renderBoard(state);
    expect(faces(container).sort()).toEqual(['AS', 'KS']);
    expect(
      screen.getByRole('group', { name: 'Your cards: Ace of Spades and King of Spades' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: `${MOTI?.name}’s cards: two face-down cards` }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('holdem-hole-2').querySelectorAll('[data-face-down]')).toHaveLength(
      2,
    );
    const html = container.innerHTML;
    for (const code of [...SECRETS, ...state.deck.slice(0, 8)]) {
      expect(html).not.toContain(`"${code}"`);
      expect(html).not.toContain(cardName(code));
    }
    expect(screen.getByTestId('holdem-community')).toHaveAttribute('data-count', '0');
    expect(
      screen.getByRole('group', { name: 'Community cards: none dealt yet' }),
    ).toBeInTheDocument();
  });

  it('helps with the learner’s hand: starting cards before the flop, the best hand after it', () => {
    const { unmount } = renderBoard(opening());
    expect(screen.getByTestId('holdem-best-hand')).toHaveTextContent(
      'Your cards Ace-King of the same suit',
    );
    unmount();

    // Everyone calls / checks to the flop: 8♠ Q♠ K♣.
    const flop = play(opening(), C, C, C, X);
    expect(flop.street).toBe('flop');
    renderBoard(flop);
    const name = evaluateHand(['AS', 'KS', '8S', 'QS', 'KC']).name;
    expect(screen.getByTestId('holdem-best-hand')).toHaveTextContent(`Your best hand ${name}`);
    expect(screen.getByTestId('holdem-best-hand')).toHaveAttribute('data-category', 'pair');
    expect(screen.getByTestId('holdem-community')).toHaveAttribute('data-count', '3');
    expect(
      screen.getByRole('group', {
        name: 'Community cards: Eight of Spades, Queen of Spades and King of Clubs',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('holdem-street')).toHaveTextContent('The flop');
    // The bets were collected into the pot.
    expect(screen.getByTestId('holdem-pot')).toHaveAttribute('data-total', '8');
    expect(screen.queryByTestId('holdem-bet-3')).not.toBeInTheDocument();
  });
});

describe('TexasHoldemBoard — actions', () => {
  it('every button submits its move; unavailable ones still try (the coach explains)', () => {
    const { onMove } = renderBoard(opening());
    expect(screen.getByTestId('holdem-call')).toHaveTextContent('Call 2');
    expect(screen.getByTestId('holdem-allin')).toHaveTextContent('All-in 100');
    expect(screen.getByTestId('holdem-check')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('holdem-call')).not.toHaveAttribute('aria-disabled');

    for (const id of ['fold', 'check', 'call', 'allin', 'raise']) {
      fireEvent.click(screen.getByTestId(`holdem-${id}`));
    }
    expect(onMove.mock.calls.map((c) => c[0])).toEqual([
      { type: 'fold' },
      { type: 'check' },
      { type: 'call' },
      { type: 'all-in' },
      { type: 'raise', to: 4 },
    ]);
  });

  it('sizes a raise with the slider and the quick sizes (the same sizes the engine lists)', () => {
    const state = opening();
    const { onMove } = renderBoard(state);
    const slider = screen.getByTestId('holdem-amount');
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '4');
    expect(slider).toHaveAttribute('max', '100');
    expect(screen.getByLabelText('Raise to (chips)')).toBe(slider);
    expect(screen.getByTestId('holdem-amount-min')).toHaveTextContent('Min 4');
    expect(screen.getByTestId('holdem-amount-max')).toHaveTextContent('Max 100');
    expect(screen.getByTestId('holdem-raise')).toHaveTextContent('Raise to 4');

    fireEvent.change(slider, { target: { value: '10' } });
    expect(slider).toHaveAttribute('aria-valuetext', '10 chips');
    fireEvent.click(screen.getByTestId('holdem-raise'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'raise', to: 10 });

    // Pot-sized raise: call 2, then raise by the 5 chips in the pot → raise to 7.
    fireEvent.click(screen.getByTestId('holdem-size-pot'));
    expect(screen.getByTestId('holdem-size-pot')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('holdem-raise')).toHaveTextContent('Raise to 7');
    fireEvent.click(screen.getByTestId('holdem-raise'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'raise', to: 7 });

    fireEvent.click(screen.getByTestId('holdem-size-max'));
    expect(screen.getByTestId('holdem-raise')).toHaveTextContent('Raise to 100 (all-in)');

    const legal = new Set(E.legalMoves(state, 0).map((m) => E.moveKey(m)));
    for (const id of ['min', 'half', 'three-quarters', 'pot']) {
      const amount = screen.getByTestId(`holdem-size-${id}`).getAttribute('data-amount');
      expect(legal.has(`raise:${amount}`)).toBe(true);
    }
  });

  it('says Bet (not Raise) when nobody has bet on this street', () => {
    const { onMove } = renderBoard(play(opening(), C, C, C, X, X, X));
    // On the flop Lakshmi (small blind) and Bunty checked; the learner may open.
    expect(screen.getByTestId('holdem-sizing')).toHaveAttribute('data-kind', 'bet');
    expect(screen.getByLabelText('Bet amount (chips)')).toHaveAttribute('min', '2');
    expect(screen.getByTestId('holdem-check')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('holdem-call')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByTestId('holdem-size-half'));
    expect(screen.getByTestId('holdem-raise')).toHaveTextContent('Bet 4');
    fireEvent.click(screen.getByTestId('holdem-raise'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'bet', amount: 4 });
  });

  it('plays from the keyboard: F, K, C, R and A anywhere, Enter / Space on focused buttons', () => {
    const { onMove } = renderBoard(opening());
    for (const key of ['f', 'K', 'c', 'r', 'a']) fireEvent.keyDown(document.body, { key });
    expect(onMove.mock.calls.map((c) => c[0].type)).toEqual([
      'fold',
      'check',
      'call',
      'raise',
      'all-in',
    ]);
    // Shortcuts work while the slider has focus (R confirms the chosen size)…
    const slider = screen.getByTestId('holdem-amount');
    slider.focus();
    fireEvent.change(slider, { target: { value: '12' } });
    fireEvent.keyDown(slider, { key: 'r' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'raise', to: 12 });
    // …but not with a modifier held or on key repeat.
    onMove.mockClear();
    fireEvent.keyDown(document.body, { key: 'f', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'f', repeat: true });
    expect(onMove).not.toHaveBeenCalled();

    // Every control is a real, focusable button or input, in table order.
    const order = [
      'holdem-fold',
      'holdem-check',
      'holdem-call',
      'holdem-allin',
      'holdem-amount',
      'holdem-size-min',
      'holdem-raise',
    ].map((id) => screen.getByTestId(id));
    for (const el of order) expect(el.tabIndex).toBe(0);
    for (let i = 1; i < order.length; i++) {
      const before = order[i - 1]!;
      expect(before.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
    expect(screen.getByTestId('holdem-fold')).toHaveAttribute('aria-keyshortcuts', 'F');
    expect(screen.getByTestId('holdem-raise')).toHaveAttribute('aria-keyshortcuts', 'R');
  });

  it('ignores presses while a bot is thinking, but keeps the buttons focusable', () => {
    // The learner calls; Moti (seat 1) is next and "thinking".
    const state = play(opening(), C);
    const { onMove } = renderBoard(state);
    const seat = screen.getByTestId('holdem-seat-1');
    expect(seat).toHaveAttribute('data-active', 'true');
    expect(within(seat).getByTestId('thinking-dots')).toBeInTheDocument();
    expect(within(seat).getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByTestId('holdem-last-0')).toHaveTextContent('Called 2');
    expect(screen.getByTestId('holdem-bet-0')).toHaveAttribute('data-bet', '2');
    const fold = screen.getByTestId('holdem-fold');
    expect(fold).toHaveAttribute('aria-disabled', 'true');
    expect(fold).not.toBeDisabled();
    expect(fold).toHaveAccessibleDescription(/Wait — it’s Maestro Moti’s turn\./);
    fireEvent.click(fold);
    fireEvent.keyDown(document.body, { key: 'c' });
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('TexasHoldemBoard — coach mode', () => {
  it('lights up the legal moves (and nothing outside coach mode)', () => {
    const state = opening();
    const { unmount } = renderBoard(state, coached(state));
    for (const id of ['fold', 'call', 'allin', 'raise']) {
      expect(screen.getByTestId(`holdem-${id}`)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.getByTestId('holdem-check')).not.toHaveAttribute('data-highlighted');
    expect(screen.getByTestId('holdem-size-min')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('holdem-size-max')).not.toHaveAttribute('data-highlighted');
    unmount();

    renderBoard(state);
    expect(document.querySelector('[data-highlighted]')).toBeNull();
  });

  it('pulses the coach’s pick, moving the slider to a suggested size', () => {
    const state = opening();
    const { rerender, props: p } = renderBoard(state, coached(state));
    expect(screen.queryByTestId('holdem-suggested-ring')).not.toBeInTheDocument();

    rerender(<TexasHoldemBoard {...p} suggestedKey="raise:7" />);
    expect(screen.getByTestId('holdem-raise')).toHaveTextContent('Raise to 7');
    expect(screen.getByTestId('holdem-raise')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('holdem-raise')).toHaveAccessibleDescription(/The coach’s pick/);
    expect(screen.getByTestId('holdem-size-pot')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('holdem-call')).not.toHaveAttribute('data-suggested');
    fireEvent.click(screen.getByTestId('holdem-raise'));
    expect(p.onMove).toHaveBeenLastCalledWith({ type: 'raise', to: 7 });

    rerender(<TexasHoldemBoard {...p} suggestedKey="call" />);
    expect(screen.getByTestId('holdem-call')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('holdem-raise')).not.toHaveAttribute('data-suggested');
    expect(screen.getAllByTestId('holdem-suggested-ring')).toHaveLength(1);
  });
});

describe('TexasHoldemBoard — the showdown', () => {
  it('turns up the hands still in, names them and lights the winning five; folded cards stay hidden', () => {
    // Lakshmi (7♥ 2♣) folds before the flop; the other three check it down.
    const end = checkDown(play(opening(), C, C, F, X));
    expect(E.isOver(end)).toBe(true);
    const { container } = renderBoard(end);

    expect(screen.getByTestId('holdem-table')).toHaveAttribute('data-street', 'over');
    expect(screen.getByTestId('holdem-street')).toHaveTextContent('Showdown');
    expect(screen.getByTestId('holdem-hole-1')).toHaveAttribute('data-revealed', 'true');
    expect(
      screen.getByRole('group', {
        name: `${MOTI?.name}’s cards: Queen of Diamonds and Queen of Clubs`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('holdem-hand-name-1')).toHaveTextContent(
      'Full House, Queens full of Eights',
    );
    expect(screen.getByTestId('holdem-hand-name-3')).toHaveTextContent(
      evaluateHand(['9S', '9D', ...BOARD.split(' ')] as CardCode[]).name,
    );
    expect(screen.getByTestId('holdem-hand-name-0')).toHaveTextContent('Flush, Ace high');
    // Only the full house's five cards are lit.
    const lit = [...container.querySelectorAll('[data-winning] [data-card]')].map((el) =>
      el.getAttribute('data-card'),
    );
    expect(lit.sort()).toEqual(['8D', '8S', 'QC', 'QD', 'QS']);
    expect(screen.getByTestId('holdem-winner-1')).toHaveTextContent('Won 7 chips');
    expect(screen.getByTestId('holdem-seat-1')).toHaveAttribute('data-winner', 'true');
    expect(screen.queryByTestId('holdem-winner-0')).not.toBeInTheDocument();
    // The folded hand is never shown.
    expect(screen.getByTestId('holdem-seat-2')).toHaveAttribute('data-folded', 'true');
    expect(screen.getByTestId('holdem-folded-2')).toHaveTextContent('Folded');
    expect(faces(container)).not.toContain('7H');
    expect(faces(container)).not.toContain('2C');
    expect(container.innerHTML).not.toMatch(/Seven of Hearts|Two of Clubs/);
    // Every action now waits.
    expect(screen.getByTestId('holdem-fold')).toHaveAccessibleDescription(/This hand is over\./);
  });

  it('a hand won by folds shows nobody’s cards', () => {
    // The learner raises to 8 and everyone folds: the 6 unmatched chips come back, and the
    // learner takes the 5-chip pot (both blinds plus their own 2).
    const end = play(opening(), R(8), F, F, F);
    expect(end.outcome?.kind).toBe('fold');
    const { container } = renderBoard(end);
    expect(faces(container).sort()).toEqual(['AS', 'KS']);
    expect(screen.getByTestId('holdem-winner-0')).toHaveTextContent('Won 5 chips');
    expect(screen.getByTestId('holdem-street')).toHaveTextContent('Hand over');
    for (const code of SECRETS) expect(container.innerHTML).not.toContain(cardName(code));
  });

  it('splits the chips into a main pot and a side pot when a short stack is all-in', () => {
    const short = deal({
      players: 4,
      button: 1,
      hands: HANDS,
      board: BOARD,
      stacks: [100, 20, 100, 100],
    });
    // Learner raises, Moti moves all-in for 20, Lakshmi folds, Bunty and the learner call;
    // on the flop the learner bets 10 and Bunty calls: 61 in the main pot, 20 on the side.
    const s = play(short, R(6), A, F, C, C, B(10), C);
    expect(s.street).toBe('turn');
    renderBoard(s);
    expect(screen.getByTestId('holdem-pot')).toHaveAttribute('data-total', '81');
    expect(screen.getByTestId('holdem-pot-0')).toHaveTextContent('Main pot 61 chips');
    expect(screen.getByTestId('holdem-pot-1')).toHaveTextContent('Side pot 20 chips');
    expect(screen.getByTestId('holdem-seat-1')).toHaveAttribute('data-all-in', 'true');
    expect(screen.getByTestId('holdem-allin-1')).toHaveTextContent('All-in');
  });

  it('keeps unanswered bets in the pot instead of calling them side pots', () => {
    // Nobody is all-in: the learner's raise to 6 is simply in the pot.
    const raised = play(opening(), R(6));
    const { unmount } = renderBoard(raised);
    expect(screen.getByTestId('holdem-pot')).toHaveAttribute('data-total', '9');
    expect(screen.queryByTestId('holdem-pots')).not.toBeInTheDocument();
    unmount();

    // Moti is all-in for 20; on the turn the learner bets 10 that Bunty has not answered
    // yet. Those 10 chips belong to the side pot, not to a third pot of their own.
    const short = deal({
      players: 4,
      button: 1,
      hands: HANDS,
      board: BOARD,
      stacks: [100, 20, 100, 100],
    });
    const s = play(short, R(6), A, F, C, C, B(10), C, X, B(10));
    expect(s.street).toBe('turn');
    renderBoard(s);
    expect(screen.getByTestId('holdem-pot')).toHaveAttribute('data-total', '91');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Main pot 61 chips',
      'Side pot 30 chips',
    ]);
  });
});

describe('TexasHoldemBoard — layout and polish', () => {
  it('sizes every hole-card box to its two cards, so discs, bets and badges never sit under them', () => {
    renderBoard(opening());
    for (const seat of [0, 1, 2, 3]) {
      const box = screen.getByTestId(`holdem-hole-${seat}`);
      // A percentage width collapses inside the shrink-to-fit seat (container queries).
      expect(box.style.width).not.toMatch(/%/);
      expect(box.style.width).toBe(box.style.minWidth);
    }
    expect(screen.getByTestId('holdem-persona-0')).toBeInTheDocument();
  });

  it('paints a live Fold in velvet, not in the gold of the other moves', () => {
    renderBoard(opening());
    const fold = screen.getByTestId('holdem-fold');
    expect(fold.className).toContain('velvet');
    expect(fold.className).not.toContain('var(--color-gold-200)_0%');
    expect(screen.getByTestId('holdem-call').className).toContain('var(--color-gold-200)_0%');
  });

  it('freezes the bet slider and quick sizes while a bot is thinking (they keep focus)', () => {
    renderBoard(play(opening(), C));
    const slider = screen.getByTestId('holdem-amount');
    expect(slider).toHaveAttribute('aria-disabled', 'true');
    expect(slider).not.toBeDisabled();
    expect(slider).toHaveAccessibleDescription(/Wait — it’s Maestro Moti’s turn\./);
    const before = (slider as HTMLInputElement).value;
    fireEvent.change(slider, { target: { value: String(Number(before) + 5) } });
    expect((slider as HTMLInputElement).value).toBe(before);
    const pot = screen.getByTestId('holdem-size-pot');
    expect(pot).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(pot);
    expect(pot).toHaveAttribute('aria-pressed', 'false');
  });
});
