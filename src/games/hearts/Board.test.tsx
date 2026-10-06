// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { useSettings } from '@/store/settings';
import { TRICK_HOLD_MS } from './board/TrickArea';
import { HeartsBoard, type HeartsBoardProps } from './Board';
import { heartsEngine as E, type HeartsMove, type HeartsState } from './engine';
import { HEARTS_BOTS } from './personas';
import { HEARTS_SEEDS } from './seeds';
import { ALL_HEARTS, finishedHand, playState } from './test-helpers';

const PERSONAS = seatPersonas(HEARTS_BOTS);

function props(state: HeartsState, extra: Partial<HeartsBoardProps> = {}) {
  const current = E.currentPlayer(state);
  const yours = current === 0;
  return {
    state,
    human: 0,
    legalMoves: yours ? E.legalMoves(state, 0) : [],
    onMove: vi.fn(),
    busy: !yours,
    thinking: current !== null && current !== 0 ? current : null,
    coachMode: false,
    highlight: new Set<string>(),
    suggestedKey: null,
    personas: PERSONAS,
    over: E.isOver(state),
    ...extra,
  } satisfies HeartsBoardProps;
}

/** Board props as the controller builds them in coach mode (every legal move highlighted). */
function coached(state: HeartsState, extra: Partial<HeartsBoardProps> = {}) {
  const base = props(state);
  return props(state, {
    coachMode: true,
    highlight: new Set(base.legalMoves.map((m) => E.moveKey(m))),
    ...extra,
  });
}

function renderBoard(state: HeartsState, extra: Partial<HeartsBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<HeartsBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

const dealt = () => E.setup({ players: 4 }, createRng(HEARTS_SEEDS.practice));

/** Apply moves, letting normal bots take their turns, until `stop` says so. */
function advance(
  state: HeartsState,
  stop: (s: HeartsState) => boolean,
  learner: (s: HeartsState) => HeartsMove = (s) => E.coach(s, 0).suggestion as HeartsMove,
): HeartsState {
  let s = state;
  const rng = createRng('board-test');
  while (!stop(s) && !E.isOver(s)) {
    const p = E.currentPlayer(s) ?? 0;
    s = E.applyMove(s, p === 0 ? learner(s) : E.botMove(s, p, 'normal', rng));
  }
  return s;
}

const handCard = (code: CardCode) =>
  within(screen.getByTestId('hearts-hand')).getByRole('button', { name: cardName(code) });

/** Every card the learner must not see: the bots' hands and the cards they passed. */
function secrets(state: HeartsState): CardCode[] {
  // Once the cards have changed hands, everyone knows who holds the 2♣: they must lead it.
  const firstLead = state.phase === 'play' && state.tricks.length === 0 && state.trick.length === 0;
  return [1, 2, 3]
    .flatMap((seat) => [
      ...(state.hands[seat] ?? []),
      ...(state.phase === 'pass' ? (state.passed[seat] ?? []) : []),
    ])
    .filter((code) => !(firstLead && code === '2C'));
}

function expectHidden(container: HTMLElement, state: HeartsState) {
  const html = container.innerHTML;
  for (const code of secrets(state)) {
    expect(html).not.toContain(`data-card="${code}"`);
    expect(html).not.toContain(cardName(code));
  }
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  useSettings.setState({ motion: 'reduce' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HeartsBoard — the table', () => {
  it('seats the three bots with avatars, card counts and points; their cards stay hidden', () => {
    const state = dealt();
    const { container } = renderBoard(state);

    for (const [seat, persona] of HEARTS_BOTS.map((p, i) => [i + 1, p] as const)) {
      const el = screen.getByTestId(`hearts-seat-${seat}`);
      expect(within(el).getByText(persona.name)).toBeInTheDocument();
      expect(
        within(el).getByRole('img', { name: `${persona.name}’s hand: 13 cards` }),
      ).toHaveAttribute('data-count', '13');
      expect(within(el).getByTestId(`hearts-points-${seat}`)).toHaveAttribute('data-points', '0');
    }
    // Only the learner's 13 cards have faces on the table.
    const faces = [...container.querySelectorAll('[data-card]')].map((el) =>
      el.getAttribute('data-card'),
    );
    expect(faces.sort()).toEqual([...(state.hands[0] ?? [])].sort());
    expectHidden(container, state);
  });

  it('labels the zones: your hand (to pass to the left), the passing compass', () => {
    renderBoard(dealt());
    expect(
      screen.getByRole('toolbar', { name: 'Your hand — pick 3 cards to pass to Auntie Bubbles' }),
    ).toHaveAttribute('data-testid', 'hearts-hand');
    expect(screen.getByTestId('hearts-passing')).toHaveTextContent('Everyone passes 3 cards left');
    expect(screen.getByTestId('hearts-pass')).toHaveTextContent('Pass 3 cards left');
    expect(screen.getByTestId('hearts-pass')).toHaveTextContent('to Auntie Bubbles');
  });

  it('shows a bot thinking with dots and its seat glowing', () => {
    const state = E.applyMove(dealt(), { type: 'pass', cards: ['QS', 'AS', 'AH'] });
    renderBoard(state);
    const seat = screen.getByTestId('hearts-seat-1');
    expect(seat).toHaveAttribute('data-thinking', 'true');
    expect(seat).toHaveAttribute('data-active', 'true');
    expect(within(seat).getByTestId('thinking-dots')).toBeInTheDocument();
    expect(within(seat).getByText('Choosing 3 cards')).toBeInTheDocument();
    expect(screen.getByTestId('hearts-seat-2')).not.toHaveAttribute('data-thinking');
  });

  it('keeps the bots’ passed cards hidden while they are in transit; shows your own', () => {
    const state = advance(dealt(), (s) => s.passed[2] !== null);
    const { container } = renderBoard(state);
    expect(state.phase).toBe('pass');
    const passed = screen.getByTestId('hearts-passed');
    expect(passed).toHaveAccessibleName(
      'On their way to Auntie Bubbles: Queen of Spades, Ace of Spades and Ace of Hearts',
    );
    expect(within(screen.getByTestId('hearts-seat-1')).getByText('Passed')).toBeInTheDocument();
    expect(within(screen.getByTestId('hearts-seat-1')).getByTestId('hearts-backs')).toHaveAttribute(
      'data-count',
      '10',
    );
    expectHidden(container, state);
  });

  it('shows the cards you received until the first trick is won', () => {
    const state = advance(dealt(), (s) => s.phase === 'play');
    const { container } = renderBoard(state);
    const received = screen.getByTestId('hearts-received');
    expect(received).toHaveAccessibleName(
      'You received from Usherette Tilly: Queen of Hearts, King of Hearts and King of Diamonds',
    );
    expect(screen.getByTestId('hearts-trick')).toHaveAccessibleName(
      'Trick 1 of 13: no cards played yet. Auntie Bubbles leads the Two of Clubs.',
    );
    expect(screen.getByTestId('hearts-trick-caption')).toHaveTextContent(
      'Auntie Bubbles leads the 2♣',
    );
    expect(screen.queryByTestId('hearts-pass')).not.toBeInTheDocument();
    expectHidden(container, state);
  });

  it('lays out the trick by seat and names every card played', () => {
    const state = advance(dealt(), (s) => s.trick.length === 3);
    renderBoard(state);
    const trick = screen.getByTestId('hearts-trick');
    expect(trick).toHaveAttribute('data-state', 'playing');
    expect(trick).toHaveAttribute('data-count', '3');
    expect(trick).toHaveAccessibleName(
      'Trick 1 of 13: Auntie Bubbles led Two of Clubs, Colonel Kofta: Jack of Clubs, Usherette Tilly: King of Clubs',
    );
    expect(
      within(screen.getByTestId('hearts-trick-slot-1')).getByText((_, el) =>
        el?.getAttribute('data-card') === '2C' ? true : false,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('hearts-trick-slot-0').querySelector('[data-card]')).toBeNull();
    expect(screen.getByTestId('hearts-trick-number')).toHaveTextContent('Trick 1 / 13');
  });

  it('glows the winning card of a finished trick, then sweeps it to the winner', () => {
    useSettings.setState({ motion: 'full' });
    vi.useFakeTimers();
    const state = advance(dealt(), (s) => s.tricks.length === 1);
    renderBoard(state);
    const trick = screen.getByTestId('hearts-trick');
    expect(trick).toHaveAttribute('data-state', 'complete');
    expect(trick).toHaveAttribute('data-winner', '3');
    expect(screen.getByTestId('hearts-trick-slot-3')).toHaveAttribute('data-winner', 'true');
    expect(
      within(screen.getByTestId('hearts-trick-slot-3')).getByTestId('hearts-trick-winner'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('hearts-trick-caption')).toHaveTextContent(
      'Usherette Tilly takes it',
    );
    expect(trick).toHaveAccessibleName(
      'Last trick, won by Usherette Tilly: Auntie Bubbles led Two of Clubs, Colonel Kofta: Jack of Clubs, Usherette Tilly: King of Clubs, You: Queen of Clubs',
    );
    // The caption sits below the four cards, never on top of them.
    expect(within(trick).queryByTestId('hearts-trick-caption')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(TRICK_HOLD_MS);
    });
    expect(trick).toHaveAttribute('data-state', 'swept');
  });

  it('with reduced motion, a finished trick simply stays until the next card', () => {
    vi.useFakeTimers();
    renderBoard(advance(dealt(), (s) => s.tricks.length === 1));
    act(() => {
      vi.advanceTimersByTime(TRICK_HOLD_MS * 3);
    });
    expect(screen.getByTestId('hearts-trick')).toHaveAttribute('data-state', 'complete');
  });

  it('shows points taken (♥ count and the Q♠) and whether Hearts are broken', () => {
    const state = playState({
      hands: [null, null, null, null],
      history: [
        '0: 2C 3C 4C 5C', // seat 3 wins with the 5♣
        '3: 2D 3D 4D 5D', // seat 2 wins with the 5♦
        '2: 6D 7D QS 8D', // seat 0 discards the Q♠, seat 1 wins with the 8♦
        '1: 6C AH KH 7C', // two Hearts discarded, seat 0 wins with the 7♣
      ],
    });
    renderBoard(state, { busy: true, legalMoves: [] });
    expect(state.points).toEqual([2, 13, 0, 0]);
    const p0 = screen.getByTestId('hearts-points-0');
    expect(p0).toHaveAttribute('data-points', String(state.points[0]));
    for (const seat of [0, 1, 2, 3]) {
      expect(screen.getByTestId(`hearts-points-${seat}`)).toHaveAttribute(
        'data-points',
        String(state.points[seat]),
      );
    }
    const queenSeat = state.won.findIndex((w) => w.includes('QS'));
    expect(screen.getByTestId(`hearts-points-${queenSeat}`)).toHaveAttribute('data-queen', 'true');
    expect(screen.getByTestId(`hearts-points-${queenSeat}`)).toHaveTextContent('Q♠');
    expect(screen.getByTestId('hearts-broken')).toHaveAttribute('data-broken', 'true');
    expect(screen.getByTestId('hearts-broken')).toHaveTextContent('Hearts broken');
  });

  it('says Hearts are not broken before the first Heart', () => {
    renderBoard(advance(dealt(), (s) => s.phase === 'play'));
    expect(screen.getByTestId('hearts-broken')).toHaveAttribute('data-broken', 'false');
    expect(screen.getByTestId('hearts-broken')).toHaveTextContent('Hearts not broken');
  });
});

describe('HeartsBoard — passing', () => {
  it('picks cards (raised, aria-pressed) and passes exactly the three picked', () => {
    const { onMove } = renderBoard(dealt());
    for (const code of ['QS', 'AS', 'AH'] as const) fireEvent.click(handCard(code));
    expect(handCard('QS')).toHaveAttribute('aria-pressed', 'true');
    expect(handCard('QC')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('hearts-pass-count')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('hearts-pass')).toHaveAttribute('data-ready', 'true');
    expect(screen.getByTestId('hearts-pass')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByTestId('hearts-pass'));
    expect(onMove).toHaveBeenCalledWith({ type: 'pass', cards: ['QS', 'AS', 'AH'] });
  });

  it('a second press puts a card back; a fourth pick swaps out the earliest', () => {
    renderBoard(dealt());
    fireEvent.click(handCard('QS'));
    fireEvent.click(handCard('QS'));
    expect(handCard('QS')).toHaveAttribute('aria-pressed', 'false');
    for (const code of ['QS', 'AS', 'AH', 'QD'] as const) fireEvent.click(handCard(code));
    expect(handCard('QS')).toHaveAttribute('aria-pressed', 'false');
    expect(handCard('QD')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('hearts-pass-count')).toHaveAttribute('data-count', '3');
  });

  it('lets the learner try to pass the wrong number of cards (the coach explains)', () => {
    const { onMove } = renderBoard(dealt());
    fireEvent.click(handCard('QS'));
    const pass = screen.getByTestId('hearts-pass');
    expect(pass).toHaveAttribute('aria-disabled', 'true');
    expect(pass).not.toHaveAttribute('disabled');
    expect(pass).toHaveAccessibleDescription(
      'to Auntie Bubbles Pick exactly 3 cards first — press it anyway and the coach explains why.',
    );
    fireEvent.click(pass);
    expect(onMove).toHaveBeenCalledWith({ type: 'pass', cards: ['QS'] });
  });

  it('works from the keyboard: one tab stop, arrows, Enter/Space to pick, P to pass', () => {
    const state = dealt();
    const { onMove } = renderBoard(state);
    const hand = screen.getByTestId('hearts-hand');
    const buttons = within(hand).getAllByRole('button');
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    const first = buttons[0]!;
    first.focus();
    fireEvent.keyDown(first, { key: 'Enter' });
    fireEvent.click(first); // Enter on a native button activates it
    fireEvent.keyDown(hand, { key: 'ArrowRight' });
    expect(buttons[1]).toHaveFocus();
    fireEvent.click(buttons[1]!);
    fireEvent.keyDown(hand, { key: 'End' });
    expect(buttons[12]).toHaveFocus();
    fireEvent.click(buttons[12]!);
    expect(screen.getByTestId('hearts-pass-count')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('hearts-pass')).toHaveAttribute('aria-keyshortcuts', 'P');
    fireEvent.keyDown(buttons[12]!, { key: 'p' });
    const mine = state.hands[0]!;
    expect(onMove).toHaveBeenCalledWith({
      type: 'pass',
      cards: [mine[0], mine[1], mine[12]],
    });
  });

  it('ignores P while typing and while it is not the learner’s turn', () => {
    const { onMove, unmount } = renderBoard(dealt());
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'p' });
    expect(onMove).not.toHaveBeenCalled();
    input.remove();
    unmount();

    const waiting = renderBoard(E.applyMove(dealt(), { type: 'pass', cards: ['QS', 'AS', 'AH'] }));
    fireEvent.keyDown(document.body, { key: 'p' });
    fireEvent.click(screen.getByTestId('hearts-pass'));
    expect(waiting.onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('hearts-pass')).toHaveAttribute('aria-disabled', 'true');
  });

  it('coach mode: the coach’s three cards glow, “Pick these 3” picks them and Pass pulses', () => {
    const state = dealt();
    const suggestion = E.coach(state, 0).suggestion as HeartsMove;
    render(<HeartsBoard {...coached(state, { suggestedKey: E.moveKey(suggestion) })} />);
    for (const code of ['QS', 'AS', 'AH'] as const) {
      expect(handCard(code).getAttribute('data-highlighted')).toBe('true');
    }
    expect(handCard('QC')).not.toHaveAttribute('data-highlighted');
    expect(screen.getByTestId('hearts-pass-suggestion')).toHaveTextContent(
      'Coach would pass: Queen of Spades, Ace of Spades and Ace of Hearts',
    );
    expect(screen.getByTestId('hearts-pass')).not.toHaveAttribute('data-suggested');
    fireEvent.click(screen.getByTestId('hearts-pass-pick'));
    expect(screen.getByTestId('hearts-pass-count')).toHaveAttribute('data-count', '3');
    // Focus moves on to Pass (the next step), so it isn't lost when this button goes away.
    expect(screen.getByTestId('hearts-pass')).toHaveFocus();
    expect(screen.getByTestId('hearts-pass')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('hearts-pass')).toHaveAccessibleDescription(
      'to Auntie Bubbles The coach’s pick',
    );
  });

  it('coach mode: Pass glows once three cards are picked; nothing glows outside coach mode', () => {
    const { unmount } = render(<HeartsBoard {...coached(dealt())} />);
    expect(screen.getByTestId('hearts-pass')).not.toHaveAttribute('data-highlighted');
    for (const code of ['QC', '4D', '5D'] as const) fireEvent.click(handCard(code));
    expect(screen.getByTestId('hearts-pass')).toHaveAttribute('data-highlighted', 'true');
    unmount();

    renderBoard(dealt());
    for (const code of ['QC', '4D', '5D'] as const) fireEvent.click(handCard(code));
    expect(screen.getByTestId('hearts-pass')).not.toHaveAttribute('data-highlighted');
  });

  it('keeps keyboard focus in the hand when the Pass button goes away', () => {
    const before = advance(dealt(), (s) => s.passed[3] === null && s.turn === 3);
    const p = props(before);
    const { rerender } = render(<HeartsBoard {...p} />);
    screen.getByTestId('hearts-pass').focus();
    const after = advance(before, (s) => s.phase === 'play');
    rerender(<HeartsBoard {...props(after)} />);
    expect(screen.queryByTestId('hearts-pass')).not.toBeInTheDocument();
    const focused = document.activeElement;
    expect(screen.getByTestId('hearts-hand')).toContainElement(focused as HTMLElement);
  });
});

describe('HeartsBoard — playing', () => {
  /** The learner's turn on trick 1: Clubs were led, and the Q♣ is the only Club. */
  const firstTrickTurn = () => advance(dealt(), (s) => s.phase === 'play' && s.turn === 0);

  it('plays any card on press — legal ones bright, the rest dimmed but still pressable', () => {
    const state = firstTrickTurn();
    const { onMove } = renderBoard(state);
    expect(E.legalMoves(state, 0)).toEqual([{ type: 'play', card: 'QC' }]);
    expect(handCard('QC')).not.toHaveAttribute('data-dimmed');
    expect(handCard('KH')).toHaveAttribute('data-dimmed', 'true');
    expect(handCard('KH')).toHaveAccessibleDescription(/can’t be played|can't be played/i);
    fireEvent.click(handCard('KH'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'play', card: 'KH' });
    fireEvent.click(handCard('QC'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'play', card: 'QC' });
  });

  it('plays from the keyboard with Enter on the focused card', () => {
    const state = firstTrickTurn();
    const { onMove } = renderBoard(state);
    const hand = screen.getByTestId('hearts-hand');
    const qc = handCard('QC');
    within(hand).getAllByRole('button')[0]!.focus();
    fireEvent.keyDown(hand, { key: 'End' });
    const mine = state.hands[0]!;
    const index = mine.indexOf('QC');
    fireEvent.keyDown(hand, { key: 'Home' });
    for (let i = 0; i < index; i++) fireEvent.keyDown(hand, { key: 'ArrowRight' });
    expect(qc).toHaveFocus();
    fireEvent.click(qc);
    expect(onMove).toHaveBeenCalledWith({ type: 'play', card: 'QC' });
  });

  it('coach mode: legal cards glow and the coach’s pick pulses', () => {
    const state = advance(
      dealt(),
      (s) => s.phase === 'play' && s.turn === 0 && s.tricks.length === 1,
    );
    const legal = E.legalMoves(state, 0).map((m) => (m.type === 'play' ? m.card : ''));
    const suggestion = E.coach(state, 0).suggestion as HeartsMove;
    render(<HeartsBoard {...coached(state, { suggestedKey: E.moveKey(suggestion) })} />);
    for (const card of state.hands[0]!) {
      const el = handCard(card);
      if (legal.includes(card)) expect(el).toHaveAttribute('data-highlighted', 'true');
      else expect(el).not.toHaveAttribute('data-highlighted');
    }
    expect(suggestion.type).toBe('play');
    if (suggestion.type === 'play') {
      expect(handCard(suggestion.card)).toHaveAttribute('data-suggested', 'true');
    }
    expect(screen.getByTestId('hearts-hand').querySelectorAll('[data-suggested]')).toHaveLength(1);
  });

  it('ignores presses while busy, but the cards stay focusable', () => {
    const state = advance(dealt(), (s) => s.phase === 'play');
    const { onMove } = renderBoard(state);
    expect(screen.getByTestId('hearts-hand')).toHaveAttribute('aria-disabled', 'true');
    const card = handCard(state.hands[0]![0]!);
    card.focus();
    expect(card).toHaveFocus();
    fireEvent.click(card);
    expect(onMove).not.toHaveBeenCalled();
    // Not the learner's turn: nothing is dimmed as unplayable.
    expect(screen.getByTestId('hearts-hand').querySelectorAll('[data-dimmed]')).toHaveLength(0);
  });

  it('never shows a bot’s cards during play', () => {
    for (const tricks of [2, 6, 11]) {
      const state = advance(dealt(), (s) => s.tricks.length === tricks && s.trick.length === 2);
      const { container, unmount } = renderBoard(state);
      expectHidden(container, state);
      unmount();
    }
  });
});

describe('HeartsBoard — the end of the hand', () => {
  it('shows the final score sheet with the winner', () => {
    const state = advance(dealt(), () => false);
    renderBoard(state);
    const sheet = screen.getByTestId('hearts-scores');
    expect(within(sheet).getByText('Final scores')).toBeInTheDocument();
    const result = E.result(state);
    for (const seat of [0, 1, 2, 3]) {
      const row = screen.getByTestId(`hearts-score-${seat}`);
      expect(row).toHaveAttribute('data-score', String(result.scores?.[seat]));
      if (result.winners.includes(seat)) expect(row).toHaveAttribute('data-winner', 'true');
      else expect(row).not.toHaveAttribute('data-winner');
    }
    expect(screen.getByTestId('hearts-score-0')).toHaveTextContent('You');
    expect(screen.queryByTestId('hearts-moon')).not.toBeInTheDocument();
    // The emptied hand collapses instead of leaving a card-high gap above the scores.
    expect(screen.queryByTestId('hearts-hand')).not.toBeInTheDocument();
    expect(screen.getByTestId('hearts-seat-0')).toHaveTextContent('You');
  });

  it('announces a moon shot with a banner and 26 for everyone else', () => {
    const state = finishedHand([
      { winner: 2, pts: 'QS AH' },
      { winner: 2, pts: 'KH QH' },
      { winner: 2, pts: 'JH TH' },
      { winner: 2, pts: '9H 8H' },
      { winner: 2, pts: '7H 6H' },
      { winner: 2, pts: '5H 4H' },
      { winner: 2, pts: '3H 2H' },
      { winner: 2 },
      { winner: 2 },
      { winner: 2 },
      { winner: 2 },
      { winner: 2 },
      { winner: 2 },
    ]);
    expect(ALL_HEARTS.split(' ')).toHaveLength(13);
    renderBoard(state);
    const moon = screen.getByTestId('hearts-moon');
    expect(moon).toHaveAttribute('data-shooter', '2');
    expect(moon).toHaveTextContent('Colonel Kofta shot the moon!');
    expect(screen.getByTestId('hearts-score-2')).toHaveAttribute('data-score', '0');
    expect(screen.getByTestId('hearts-score-0')).toHaveAttribute('data-score', '26');
    expect(screen.getByTestId('hearts-points-2')).toHaveAttribute('data-points', '26');
  });
});
