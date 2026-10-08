// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { cardName } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { useSettings } from '@/store/settings';
import { BaccaratBoard, mathView, ruleLines, type BaccaratBoardProps } from './Board';
import { baccaratEngine as E, DEALER, LEARNER, type BaccaratState, type BetOn } from './engine';
import baccaratModule from './index';
import { CROUPIER_CHANDNI } from './personas';
import { BACCARAT_SEEDS } from './seeds';

const PERSONAS = seatPersonas([CROUPIER_CHANDNI]);

function props(state: BaccaratState, extra: Partial<BaccaratBoardProps> = {}) {
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
  } satisfies BaccaratBoardProps;
}

function renderBoard(state: BaccaratState, extra: Partial<BaccaratBoardProps> = {}) {
  const onMove = vi.fn<BaccaratBoardProps['onMove']>();
  const p = props(state, { onMove, ...extra });
  const view = render(<BaccaratBoard {...p} />);
  return { ...view, onMove, props: p };
}

/** The coup for `seed`, bet on `on` and dealt `deals` cards (all of them by default). */
function coup(seed: number, on: BetOn | null = null, deals = Infinity): BaccaratState {
  let state = E.setup(baccaratModule.defaultConfig, createRng(seed));
  if (on === null) return state;
  state = E.applyMove(state, { type: 'bet', on });
  for (let i = 0; i < deals && !E.isOver(state); i++) {
    state = E.applyMove(state, { type: 'deal' });
  }
  return state;
}

const faces = (root: HTMLElement) =>
  [...root.querySelectorAll('[data-card]')].map((el) => el.getAttribute('data-card')).sort();

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

describe('BaccaratBoard — before the bet', () => {
  it('shows the croupier, two empty hands, the felt and three betting spots', () => {
    const { container } = renderBoard(coup(BACCARAT_SEEDS.practice));
    const seat = screen.getByTestId('bac-dealer-seat');
    expect(within(seat).getByText('Croupier Chandni')).toBeInTheDocument();
    expect(within(seat).getByText(CROUPIER_CHANDNI.tagline)).toBeInTheDocument();

    expect(screen.getByRole('group', { name: 'Player hand: no cards yet' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Banker hand: no cards yet' })).toBeInTheDocument();
    expect(screen.getByTestId('bac-player-total')).not.toHaveAttribute('data-total');
    expect(screen.getByTestId('bac-felt-print')).toHaveTextContent('Punto Banco');
    expect(screen.getByTestId('bac-prompt')).toHaveTextContent('Place your bet');
    expect(screen.getByTestId('bac-rules')).toHaveTextContent(
      'Place a bet and the dealer deals: Player, Banker, Player, Banker.',
    );
    // A beginner learns what the cards are worth before the first card lands.
    expect(screen.getAllByTestId('bac-rule')[0]).toHaveAttribute('data-rule', 'values');
    expect(screen.getByTestId('bac-rules')).toHaveTextContent('tens and picture cards count 0');

    const spots = within(screen.getByRole('group', { name: 'Betting spots' })).getAllByRole(
      'button',
    );
    expect(spots.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bet on Player — pays 1 to 1',
      'Bet on Tie — pays 8 to 1',
      'Bet on Banker — pays 0.95 to 1',
    ]);
    for (const b of spots) {
      expect(b).toHaveAttribute('data-legal', 'true');
      expect(b).not.toHaveAttribute('aria-disabled');
    }
    // The exact chance of each outcome for an 8-deck shoe, printed on the spot.
    expect(screen.getByTestId('bac-banker')).toHaveTextContent('wins 45.9%');
    expect(screen.getByTestId('bac-player')).toHaveTextContent('wins 44.6%');
    expect(screen.getByTestId('bac-tie')).toHaveTextContent('wins 9.5%');
    // Nothing is dealt: no card face anywhere.
    expect(faces(container)).toEqual([]);
  });

  it('every spot bets on its hand when pressed', () => {
    const { onMove } = renderBoard(coup(BACCARAT_SEEDS.practice));
    fireEvent.click(screen.getByTestId('bac-player'));
    fireEvent.click(screen.getByTestId('bac-banker'));
    fireEvent.click(screen.getByTestId('bac-tie'));
    expect(onMove.mock.calls).toEqual([
      [{ type: 'bet', on: 'player' }],
      [{ type: 'bet', on: 'banker' }],
      [{ type: 'bet', on: 'tie' }],
    ]);
  });

  it('P, B and T bet from anywhere on the page (but not while typing, with modifiers or on repeat)', () => {
    const { onMove } = renderBoard(coup(BACCARAT_SEEDS.practice));
    fireEvent.keyDown(document.body, { key: 'p' });
    fireEvent.keyDown(document.body, { key: 'B' });
    fireEvent.keyDown(document.body, { key: 't' });
    expect(onMove.mock.calls).toEqual([
      [{ type: 'bet', on: 'player' }],
      [{ type: 'bet', on: 'banker' }],
      [{ type: 'bet', on: 'tie' }],
    ]);
    onMove.mockClear();

    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'b' });
    input.remove();
    fireEvent.keyDown(document.body, { key: 'b', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'b', repeat: true });
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('bac-banker')).toHaveAttribute('aria-keyshortcuts', 'B');
  });

  it('arrow keys move between the spots, and Enter / Space bet', () => {
    const { onMove } = renderBoard(coup(BACCARAT_SEEDS.practice));
    const player = screen.getByTestId('bac-player');
    player.focus();
    fireEvent.keyDown(player, { key: 'ArrowRight' });
    expect(screen.getByTestId('bac-tie')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getByTestId('bac-banker')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(player).toHaveFocus();
    fireEvent.keyDown(player, { key: 'ArrowLeft' });
    expect(screen.getByTestId('bac-banker')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(player).toHaveFocus();
    fireEvent.keyDown(player, { key: 'End' });
    const banker = screen.getByTestId('bac-banker');
    expect(banker).toHaveFocus();
    // Real <button>s: Enter and Space activate them natively (a click event).
    expect(banker.tagName).toBe('BUTTON');
    expect(banker).toHaveAttribute('type', 'button');
    fireEvent.click(banker);
    expect(onMove).toHaveBeenCalledWith({ type: 'bet', on: 'banker' });
  });

  it('glows every legal spot in coach mode and pulses the coach’s pick', () => {
    const state = coup(BACCARAT_SEEDS.practice);
    const highlight = new Set(E.legalMoves(state, LEARNER).map((m) => E.moveKey(m)));
    const { rerender, props: p } = renderBoard(state, { coachMode: true, highlight });
    for (const id of ['bac-player', 'bac-banker', 'bac-tie']) {
      expect(screen.getByTestId(id)).toHaveAttribute('data-highlighted', 'true');
      expect(screen.getByTestId(id)).not.toHaveAttribute('data-suggested');
    }

    rerender(<BaccaratBoard {...p} suggestedKey="bet:banker" />);
    const banker = screen.getByTestId('bac-banker');
    expect(banker).toHaveAttribute('data-suggested', 'true');
    expect(within(banker).getByTestId('bac-suggested-ring')).toBeInTheDocument();
    expect(banker).toHaveAccessibleDescription(/The coach’s pick/);
    expect(screen.getByTestId('bac-player')).not.toHaveAttribute('data-suggested');

    // Outside coach mode nothing glows.
    rerender(<BaccaratBoard {...p} coachMode={false} highlight={new Set()} />);
    expect(screen.getByTestId('bac-player')).not.toHaveAttribute('data-highlighted');
  });
});

describe('BaccaratBoard — the deal', () => {
  it('locks the spots while the croupier deals: presses are ignored but focus stays', () => {
    const state = coup(BACCARAT_SEEDS.practice, 'banker', 1);
    const { onMove } = renderBoard(state);
    const seat = screen.getByTestId('bac-dealer-seat');
    expect(seat).toHaveAttribute('data-active', 'true');
    expect(seat).toHaveAttribute('data-thinking', 'true');
    expect(within(seat).getByText('Dealing')).toBeInTheDocument();
    expect(screen.getByTestId('bac-prompt')).toHaveTextContent(
      'Bets are locked — Croupier Chandni is dealing.',
    );

    const player = screen.getByTestId('bac-player');
    expect(player).toHaveAttribute('aria-disabled', 'true');
    expect(player).toHaveAccessibleDescription(/Bets are locked/);
    player.focus();
    fireEvent.click(player);
    fireEvent.keyDown(document.body, { key: 'p' });
    expect(onMove).not.toHaveBeenCalled();
    expect(player).toHaveFocus();

    // The chip sits on the chosen spot.
    const banker = screen.getByTestId('bac-banker');
    expect(banker).toHaveAttribute('data-chosen', 'true');
    expect(within(banker).getByTestId('bac-chip')).toBeInTheDocument();
    expect(banker).toHaveAccessibleDescription(/Your bet is on this spot/);
    expect(within(player).queryByTestId('bac-chip')).not.toBeInTheDocument();
  });

  it('only face-up cards reach the DOM — never the shoe', () => {
    for (let deals = 0; deals <= 6; deals++) {
      const state = coup(BACCARAT_SEEDS.practice, 'banker', deals);
      const { container, unmount } = renderBoard(state);
      const dealt = [...state.player, ...state.banker];
      expect(faces(container)).toEqual([...dealt].sort());
      const next = state.shoe[0]!;
      if (!dealt.includes(next)) {
        expect(container.innerHTML).not.toContain(cardName(next));
        expect(container.innerHTML).not.toContain(`"${next}"`);
      }
      unmount();
    }
  });

  it('labels the hands, totals them and works out the sum (only the last digit counts)', () => {
    renderBoard(coup(BACCARAT_SEEDS.practice, 'banker'));
    expect(
      screen.getByRole('group', {
        name: 'Player hand: King of Clubs, Two of Diamonds and Three of Diamonds (third card)',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('bac-player-total')).toHaveAttribute('data-total', '5');
    expect(screen.getByTestId('bac-banker-total')).toHaveAttribute('data-total', '9');
    expect(screen.getByTestId('bac-player-total').parentElement).toHaveTextContent(
      'Player total: 5',
    );
    expect(screen.getByTestId('bac-player-math')).toHaveTextContent('K + 2 + 3 = 5');
    expect(screen.getByTestId('bac-banker-math')).toHaveTextContent('J + 4 + 5 = 9');

    expect(mathView(['9H', '8S'])?.text).toBe('9 + 8 = 17 → 7');
    expect(mathView(['9H', '8S'])?.sr).toBe('9 + 8 makes 17; only the last digit counts, so 7.');
    expect(mathView(['TD', '5C'])?.text).toBe('10 + 5 = 5');
    expect(mathView([])).toBeNull();
  });

  it('captions each drawing rule as it applies', () => {
    const seed = BACCARAT_SEEDS.practice;
    expect(ruleLines(coup(seed, 'banker', 2)).map((l) => l.text)).toEqual([
      'Aces count 1; tens and picture cards count 0; only the last digit of a total counts.',
      'Two cards each, one at a time: Player, Banker, Player, Banker.',
    ]);
    expect(ruleLines(coup(seed, 'banker', 4)).map((l) => l.text)).toEqual([
      'Player has 2 → draws a third card (0–5 draws).',
    ]);
    expect(ruleLines(coup(seed, 'banker', 5)).map((l) => l.text)).toEqual([
      'Player has 2 → draws a third card (0–5 draws).',
      'Banker has 4, Player’s third card is worth 3 → Banker draws.',
    ]);
    renderBoard(coup(seed, 'banker'));
    const rules = screen.getAllByTestId('bac-rule');
    expect(rules.map((r) => r.dataset.rule)).toEqual(['player', 'banker', 'done']);
    expect(rules[2]).toHaveTextContent('No more cards: Banker wins 9 to 5.');
    expect(rules[2]).toHaveAttribute('data-latest', 'true');

    expect(
      ruleLines(coup(BACCARAT_SEEDS.playerStandsBankerDraws, 'banker')).map((l) => l.text),
    ).toEqual([
      'Player has 7 → stands (6 or 7 stands).',
      'Player stood. Banker has 5 → Banker draws (draws on 0–5).',
      'No more cards: Player wins 7 to 0.',
    ]);
  });

  it('marks the hand that gets the next card', () => {
    renderBoard(coup(BACCARAT_SEEDS.practice, 'banker', 4));
    expect(screen.getByTestId('bac-player-hand')).toHaveAttribute('data-next', 'true');
    expect(screen.getByTestId('bac-banker-hand')).not.toHaveAttribute('data-next');
  });
});

describe('BaccaratBoard — the result', () => {
  it('a winning Banker bet: banner, winning hand, WIN stamp and a paid chip', () => {
    renderBoard(coup(BACCARAT_SEEDS.practice, 'banker'));
    const banner = screen.getByTestId('bac-result');
    expect(banner).toHaveAttribute('data-winner', 'banker');
    expect(banner).toHaveTextContent('Result: Banker wins, 9 to 5.');
    expect(screen.getByTestId('bac-banker-hand')).toHaveAttribute('data-winner', 'true');
    expect(screen.getByTestId('bac-banker-wins')).toBeInTheDocument();
    const stamp = within(screen.getByTestId('bac-banker')).getByTestId('bac-outcome');
    expect(stamp).toHaveAttribute('data-outcome', 'win');
    expect(within(screen.getByTestId('bac-banker')).getByTestId('bac-chip-paid')).toBeVisible();
    expect(screen.getByTestId('bac-prompt')).toHaveTextContent('The coup is over.');
    for (const id of ['bac-player', 'bac-banker', 'bac-tie']) {
      expect(screen.getByTestId(id)).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('a natural: the badge, the "nobody draws" rule and the Natural banner', () => {
    renderBoard(coup(BACCARAT_SEEDS.bankerNatural, 'banker'));
    expect(screen.getByTestId('bac-banker-natural')).toHaveTextContent('Natural 9');
    expect(screen.getByTestId('bac-banker-total')).toHaveAttribute('data-natural', 'true');
    expect(screen.queryByTestId('bac-player-natural')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('bac-rule')[0]).toHaveTextContent(
      'Banker has a natural 9 → nobody draws.',
    );
    expect(screen.getByTestId('bac-natural-banner')).toHaveTextContent('Natural!');
  });

  it('a lost bet is collected', () => {
    renderBoard(coup(BACCARAT_SEEDS.playerNatural, 'banker'));
    const banker = screen.getByTestId('bac-banker');
    expect(within(banker).getByTestId('bac-outcome')).toHaveAttribute('data-outcome', 'loss');
    expect(within(banker).getByTestId('bac-chip')).toHaveAttribute('data-collected', 'true');
    expect(within(banker).queryByTestId('bac-chip-paid')).not.toBeInTheDocument();
    expect(screen.getByTestId('bac-result')).toHaveAttribute('data-winner', 'player');
  });

  it('a tie: the Tie banner, and a Banker bet pushes while a Tie bet wins', () => {
    const { unmount } = renderBoard(coup(BACCARAT_SEEDS.tie, 'banker'));
    expect(screen.getByTestId('bac-tie-banner')).toHaveTextContent('Tie!');
    expect(screen.getByTestId('bac-result')).toHaveTextContent('Tie at 8');
    // Visibly "Tie! Both on 8" (not "Tie! Tie at 8"); screen readers hear "Result: Tie at 8."
    expect(screen.getByTestId('bac-result')).toHaveTextContent('Both on 8');
    expect(screen.getByTestId('bac-result')).not.toHaveTextContent(/Tie!\s*Tie at/);
    expect(within(screen.getByTestId('bac-banker')).getByTestId('bac-outcome')).toHaveAttribute(
      'data-outcome',
      'push',
    );
    unmount();

    renderBoard(coup(BACCARAT_SEEDS.tie, 'tie'));
    expect(within(screen.getByTestId('bac-tie')).getByTestId('bac-outcome')).toHaveAttribute(
      'data-outcome',
      'win',
    );
  });
});

describe('BaccaratBoard — dealing animation', () => {
  it('cards fly from the shoe face down and turn up as they land', async () => {
    useSettings.setState({ motion: 'full' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const before = coup(BACCARAT_SEEDS.practice, 'banker', 0);
    const { container, rerender, props: p } = renderBoard(before);
    const after = E.applyMove(before, { type: 'deal' });
    rerender(<BaccaratBoard {...p} {...props(after)} />);

    // In flight: face down — but the zone label already names it.
    expect(faces(container)).toEqual([]);
    expect(container.querySelectorAll('[data-face-down]')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Player hand: King of Clubs' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(faces(container)).toEqual(['KC']);
  });

  it('with reduced motion the card is simply there', () => {
    const { container } = renderBoard(coup(BACCARAT_SEEDS.practice, 'banker', 1));
    expect(faces(container)).toEqual(['KC']);
  });
});
