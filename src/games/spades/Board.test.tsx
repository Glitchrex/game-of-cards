// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { seatPersonas } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { useSettings } from '@/store/settings';
import { TRICK_HOLD_MS } from './board/TrickArea';
import { SpadesBoard, type SpadesBoardProps } from './Board';
import { spadesEngine as E, type SpadesMove, type SpadesState } from './engine';
import { SPADES_BOTS } from './personas';
import { SPADES_SEEDS } from './seeds';
import { finishedHand, playState, winnersFor } from './test-helpers';

vi.mock('@/components/layout/LiveAnnouncer', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  announce: vi.fn(),
}));

const PERSONAS = seatPersonas(SPADES_BOTS);

function props(state: SpadesState, extra: Partial<SpadesBoardProps> = {}) {
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
  } satisfies SpadesBoardProps;
}

/** Board props as the controller builds them in coach mode (every legal move highlighted). */
function coached(state: SpadesState, extra: Partial<SpadesBoardProps> = {}) {
  const base = props(state);
  return props(state, {
    coachMode: true,
    highlight: new Set(base.legalMoves.map((m) => E.moveKey(m))),
    ...extra,
  });
}

function renderBoard(state: SpadesState, extra: Partial<SpadesBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<SpadesBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

/** The practice deal: Lady Limelight deals, so the learner bids first. */
const dealt = () => E.setup({ players: 4 }, createRng(SPADES_SEEDS.practice));

/** Apply moves, letting normal bots take their turns, until `stop` says so. */
function advance(
  state: SpadesState,
  stop: (s: SpadesState) => boolean,
  learner: (s: SpadesState) => SpadesMove = (s) => E.coach(s, 0).suggestion as SpadesMove,
): SpadesState {
  let s = state;
  const rng = createRng('board-test');
  while (!stop(s) && !E.isOver(s)) {
    const p = E.currentPlayer(s) ?? 0;
    s = E.applyMove(s, p === 0 ? learner(s) : E.botMove(s, p, 'normal', rng));
  }
  return s;
}

const handCard = (code: CardCode) =>
  within(screen.getByTestId('spades-hand')).getByRole('button', { name: cardName(code) });

function expectHidden(container: HTMLElement, state: SpadesState) {
  const html = container.innerHTML;
  for (const code of [1, 2, 3].flatMap((seat) => state.hands[seat] ?? [])) {
    expect(html).not.toContain(`data-card="${code}"`);
    expect(html).not.toContain(cardName(code));
  }
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  useSettings.setState({ motion: 'reduce' });
  vi.mocked(announce).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SpadesBoard — the table', () => {
  it('seats the partner across and the opponents left and right; their cards stay hidden', () => {
    const state = dealt();
    const { container } = renderBoard(state);
    for (const [seat, persona] of SPADES_BOTS.map((p, i) => [i + 1, p] as const)) {
      const el = screen.getByTestId(`spades-seat-${seat}`);
      expect(within(el).getByText(persona.name)).toBeInTheDocument();
      expect(
        within(el).getByRole('img', { name: `${persona.name}’s hand: 13 cards` }),
      ).toHaveAttribute('data-count', '13');
      expect(within(el).getByTestId(`spades-bid-badge-${seat}`)).not.toHaveAttribute('data-bid');
      expect(within(el).getByTestId(`spades-tricks-${seat}`)).toHaveAttribute('data-tricks', '0');
    }
    expect(screen.getByTestId('spades-seat-2')).toHaveAttribute('data-partner', 'true');
    expect(screen.getByTestId('spades-role-2')).toHaveTextContent('Partner');
    expect(screen.getByTestId('spades-role-1')).toHaveTextContent('Opponent');
    expect(screen.getByTestId('spades-role-3')).toHaveTextContent('Opponent');
    expect(screen.getByRole('group', { name: 'Mausi Marigold, Partner' })).toBe(
      screen.getByTestId('spades-seat-2'),
    );
    // Only the learner's 13 cards have faces on the table.
    const faces = [...container.querySelectorAll('[data-card]')].map((el) =>
      el.getAttribute('data-card'),
    );
    expect(faces.sort()).toEqual([...(state.hands[0] ?? [])].sort());
    expectHidden(container, state);
  });

  it('shows the bidding centrepiece, the team panels and the learner’s turn', () => {
    renderBoard(dealt());
    expect(screen.getByTestId('spades-board')).toHaveAttribute('data-phase', 'bid');
    expect(screen.getByTestId('spades-bidding-centre')).toHaveTextContent('Bidding');
    expect(screen.getByTestId('spades-bidding-centre')).toHaveTextContent(
      'Your bid — how many tricks will you win?',
    );
    expect(screen.queryByTestId('spades-trick')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spades-broken')).not.toBeInTheDocument();
    expect(screen.getByTestId('spades-team-us-progress')).toHaveTextContent('0/—');
    expect(screen.getByTestId('spades-your-turn')).toHaveTextContent('Your turn');
    expect(screen.getByTestId('spades-seat-0')).toHaveAttribute('data-active', 'true');
    expect(
      screen.getByRole('toolbar', { name: 'Your hand — look it over, then bid' }),
    ).toHaveAttribute('data-testid', 'spades-hand');
  });

  it('shows a bot thinking with dots and its seat glowing', () => {
    const state = E.applyMove(dealt(), { type: 'bid', tricks: 3 });
    renderBoard(state);
    const seat = screen.getByTestId('spades-seat-1');
    expect(seat).toHaveAttribute('data-thinking', 'true');
    expect(seat).toHaveAttribute('data-active', 'true');
    expect(within(seat).getByTestId('thinking-dots')).toBeInTheDocument();
    expect(within(seat).getByText('Choosing a bid')).toBeInTheDocument();
    expect(screen.getByTestId('spades-seat-2')).not.toHaveAttribute('data-thinking');
    expect(screen.getByTestId('spades-bidding-centre')).toHaveTextContent(
      'Stuntman Rafi is choosing a bid',
    );
    expect(screen.getByTestId('spades-bid-badge-0')).toHaveAttribute('data-bid', '3');
    expect(screen.getByTestId('spades-bid-badge-0')).toHaveTextContent('Bid 3');
  });

  it('shows every bid as a badge, Nil clearly, and the team contracts once bidding ends', () => {
    const state = playState({ hands: [null, null, null, null], bids: [0, 4, 5, 3] });
    renderBoard(state);
    expect(screen.getByTestId('spades-bid-badge-0')).toHaveAttribute('data-nil', 'true');
    expect(screen.getByTestId('spades-bid-badge-0')).toHaveTextContent('Nil');
    expect(screen.getByTestId('spades-bid-badge-0')).toHaveTextContent('You bid Nil');
    expect(screen.getByTestId('spades-bid-badge-1')).toHaveTextContent('Bid 4');
    expect(screen.getByTestId('spades-bid-badge-2')).toHaveTextContent(
      'Mausi Marigold bid 5 tricks',
    );
    const us = screen.getByTestId('spades-team-us');
    // A Nil bidder's tricks never count toward the partner's bid: the contract is 5.
    expect(us).toHaveAttribute('data-bid', '5');
    expect(screen.getByTestId('spades-team-us-progress')).toHaveTextContent('0/5');
    expect(us).toHaveTextContent(
      'Your team (You & Mausi Marigold) has won 0 tricks toward a bid of 5 tricks',
    );
    expect(screen.getByTestId('spades-team-them-progress')).toHaveTextContent('0/7');
    expect(screen.getByTestId('spades-nil-0')).toHaveAttribute('data-safe', 'true');
    expect(screen.getByTestId('spades-nil-0')).toHaveTextContent('Your Nil: safe so far');
  });
});

describe('SpadesBoard — bidding', () => {
  it('offers Nil to 13 as a radio group; the Bid button sends the picked bid', () => {
    const { onMove } = renderBoard(dealt());
    const group = screen.getByRole('radiogroup', { name: 'How many tricks will you win?' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(14);
    expect(screen.getByTestId('spades-bid-0')).toHaveAccessibleName('Nil — win no tricks');
    expect(screen.getByTestId('spades-bid-0')).toHaveTextContent('Nil');
    expect(screen.getByTestId('spades-bid-13')).toHaveAccessibleName('13 tricks');
    fireEvent.click(screen.getByTestId('spades-bid-3'));
    expect(screen.getByTestId('spades-bid-3')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('spades-bid-4')).toHaveAttribute('aria-checked', 'false');
    const submit = screen.getByTestId('spades-bid-submit');
    expect(submit).toHaveTextContent('Bid 3 tricks');
    expect(submit).toHaveAttribute('data-ready', 'true');
    expect(submit).not.toHaveAttribute('aria-disabled');
    // Its name says it all; no empty or repeated description.
    expect(submit).toHaveAccessibleName('Bid 3 tricks Lock in your bid');
    expect(submit).not.toHaveAttribute('aria-describedby');
    fireEvent.click(submit);
    expect(onMove).toHaveBeenCalledWith({ type: 'bid', tricks: 3 });
    fireEvent.click(screen.getByTestId('spades-bid-0'));
    fireEvent.click(submit);
    expect(onMove).toHaveBeenLastCalledWith({ type: 'bid', tricks: 0 });
  });

  it('asks for a number first when Bid is pressed with nothing picked', () => {
    const { onMove } = renderBoard(dealt());
    const submit = screen.getByTestId('spades-bid-submit');
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(submit).not.toHaveAttribute('disabled');
    expect(submit).toHaveAccessibleName('Bid Pick a number first');
    expect(submit).toHaveAccessibleDescription('Pick how many tricks you will win first.');
    fireEvent.click(submit);
    expect(onMove).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith('Pick a number of tricks first, then press Bid.');
  });

  it('works from the keyboard: one tab stop, arrows select, digits pick, B bids', () => {
    const { onMove } = renderBoard(dealt());
    const radios = within(screen.getByTestId('spades-bid-options')).getAllByRole('radio');
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([screen.getByTestId('spades-bid-0')]);
    radios[0]!.focus();
    fireEvent.keyDown(radios[0]!, { key: 'ArrowRight' });
    expect(screen.getByTestId('spades-bid-1')).toHaveFocus();
    expect(screen.getByTestId('spades-bid-1')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('spades-bid-1').tabIndex).toBe(0);
    fireEvent.keyDown(screen.getByTestId('spades-bid-1'), { key: 'End' });
    expect(screen.getByTestId('spades-bid-13')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('spades-bid-13'), { key: 'ArrowRight' });
    expect(screen.getByTestId('spades-bid-0')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('spades-bid-0'), { key: 'ArrowLeft' });
    expect(screen.getByTestId('spades-bid-13')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByTestId('spades-bid-13'), { key: 'Home' });
    expect(screen.getByTestId('spades-bid-0')).toHaveAttribute('aria-checked', 'true');
    // Digits pick from anywhere on the page; B bids.
    fireEvent.keyDown(document.body, { key: '4' });
    expect(screen.getByTestId('spades-bid-4')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('spades-bid-4')).toHaveFocus();
    expect(screen.getByTestId('spades-bid-submit')).toHaveAttribute('aria-keyshortcuts', 'B');
    fireEvent.keyDown(document.body, { key: 'b' });
    expect(onMove).toHaveBeenCalledWith({ type: 'bid', tricks: 4 });
  });

  it('ignores the shortcuts while typing, with modifiers, and once the learner has bid', () => {
    const { onMove, unmount } = renderBoard(dealt());
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '5' });
    expect(screen.getByTestId('spades-bid-5')).toHaveAttribute('aria-checked', 'false');
    fireEvent.keyDown(document.body, { key: '5', ctrlKey: true });
    expect(screen.getByTestId('spades-bid-5')).toHaveAttribute('aria-checked', 'false');
    input.remove();
    unmount();

    const after = renderBoard(E.applyMove(dealt(), { type: 'bid', tricks: 3 }));
    expect(screen.queryByTestId('spades-bidding')).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: '2' });
    fireEvent.keyDown(document.body, { key: 'b' });
    expect(after.onMove).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('while a bot bids first, the learner can pre-pick but Bid waits its turn', () => {
    // Seed 2: the opponents open the bidding.
    const state = E.setup({ players: 4 }, createRng(SPADES_SEEDS.botsBidFirst));
    expect(E.currentPlayer(state)).not.toBe(0);
    const { onMove } = renderBoard(state);
    fireEvent.click(screen.getByTestId('spades-bid-2'));
    expect(screen.getByTestId('spades-bid-2')).toHaveAttribute('aria-checked', 'true');
    const submit = screen.getByTestId('spades-bid-submit');
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(submit).toHaveAccessibleDescription(/Wait — .+ is bidding\./);
    fireEvent.click(submit);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('lets the learner try to play a card during bidding (the coach explains)', () => {
    const { onMove } = renderBoard(dealt());
    fireEvent.click(handCard('AS'));
    expect(onMove).toHaveBeenCalledWith({ type: 'play', card: 'AS' });
    expect(E.checkMove(dealt(), 0, { type: 'play', card: 'AS' }).ok).toBe(false);
  });

  it('coach mode: the coach’s bid pulses, “Suggested: 3 tricks” picks it, Bid pulses', () => {
    const state = dealt();
    const suggestion = E.coach(state, 0).suggestion as SpadesMove;
    expect(suggestion).toEqual({ type: 'bid', tricks: 3 });
    render(<SpadesBoard {...coached(state, { suggestedKey: E.moveKey(suggestion) })} />);
    expect(screen.getByTestId('spades-bid-3')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('spades-bid-3')).toHaveAccessibleDescription('The coach’s pick');
    expect(screen.getByTestId('spades-bid-5')).not.toHaveAttribute('data-suggested');
    expect(screen.getByTestId('spades-bid-5')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('spades-bid-3').tabIndex).toBe(0);
    const chip = screen.getByTestId('spades-bid-suggestion');
    expect(chip).toHaveTextContent('Suggested: 3 tricks');
    expect(screen.getByTestId('spades-bid-submit')).not.toHaveAttribute('data-suggested');
    fireEvent.click(chip);
    expect(screen.getByTestId('spades-bid-3')).toHaveAttribute('aria-checked', 'true');
    const submit = screen.getByTestId('spades-bid-submit');
    expect(submit).toHaveAttribute('data-suggested', 'true');
    expect(submit).toHaveAccessibleName('Bid 3 tricks Lock in your bid');
    expect(submit).toHaveAccessibleDescription('The coach’s pick');
  });

  it('coach mode: Bid glows once a bid is picked; nothing glows outside coach mode', () => {
    const { unmount } = render(<SpadesBoard {...coached(dealt())} />);
    expect(screen.getByTestId('spades-bid-submit')).not.toHaveAttribute('data-highlighted');
    fireEvent.click(screen.getByTestId('spades-bid-6'));
    expect(screen.getByTestId('spades-bid-submit')).toHaveAttribute('data-highlighted', 'true');
    unmount();

    renderBoard(dealt());
    fireEvent.click(screen.getByTestId('spades-bid-6'));
    expect(screen.getByTestId('spades-bid-submit')).not.toHaveAttribute('data-highlighted');
    expect(
      screen.getByTestId('spades-bid-options').querySelectorAll('[data-highlighted]'),
    ).toHaveLength(0);
  });

  it('keeps keyboard focus in the hand when the bid picker goes away', () => {
    const before = dealt();
    const { rerender } = render(<SpadesBoard {...props(before)} />);
    screen.getByTestId('spades-bid-submit').focus();
    rerender(<SpadesBoard {...props(E.applyMove(before, { type: 'bid', tricks: 3 }))} />);
    expect(screen.queryByTestId('spades-bid-submit')).not.toBeInTheDocument();
    expect(screen.getByTestId('spades-hand')).toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});

describe('SpadesBoard — playing', () => {
  /** The learner leads trick 1: Spades are not broken yet. */
  const firstLead = () => advance(dealt(), (s) => s.phase === 'play' && s.turn === 0);

  it('plays any card on press — legal ones bright, the rest dimmed but still pressable', () => {
    const state = firstLead();
    const { onMove } = renderBoard(state);
    expect(state.trick).toHaveLength(0);
    expect(handCard('TD')).not.toHaveAttribute('data-dimmed');
    expect(handCard('AS')).toHaveAttribute('data-dimmed', 'true');
    expect(handCard('AS')).toHaveAccessibleDescription(/can’t be played|can't be played/i);
    fireEvent.click(handCard('AS'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'play', card: 'AS' });
    fireEvent.click(handCard('TD'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'play', card: 'TD' });
    expect(screen.getByTestId('spades-broken')).toHaveAttribute('data-broken', 'false');
    expect(screen.getByTestId('spades-broken')).toHaveTextContent('Spades not broken');
    expect(screen.getByTestId('spades-trick')).toHaveAccessibleName(
      'Trick 1 of 13: no cards played yet. You to lead.',
    );
    expect(screen.getByTestId('spades-trick-caption')).toHaveTextContent('You lead');
    expect(screen.getByTestId('spades-team-us-progress')).toHaveTextContent('0/6');
    expect(screen.getByTestId('spades-team-them-progress')).toHaveTextContent('0/4');
  });

  it('plays from the keyboard: one tab stop, arrows, Enter on the focused card', () => {
    const state = firstLead();
    const { onMove } = renderBoard(state);
    const hand = screen.getByTestId('spades-hand');
    const buttons = within(hand).getAllByRole('button');
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    // Focusing a card updates the Hand's roving tab stop: do it inside act().
    act(() => buttons[0]!.focus());
    fireEvent.keyDown(hand, { key: 'End' });
    expect(buttons[12]).toHaveFocus();
    const index = state.hands[0]!.indexOf('TD');
    fireEvent.keyDown(hand, { key: 'Home' });
    for (let i = 0; i < index; i++) fireEvent.keyDown(hand, { key: 'ArrowRight' });
    expect(handCard('TD')).toHaveFocus();
    fireEvent.click(handCard('TD')); // Enter/Space on a native button activates it
    expect(onMove).toHaveBeenCalledWith({ type: 'play', card: 'TD' });
  });

  it('coach mode: legal cards glow and the coach’s pick pulses', () => {
    const state = advance(
      dealt(),
      (s) => s.phase === 'play' && s.turn === 0 && s.tricks.length === 1,
    );
    const legal = E.legalMoves(state, 0).map((m) => (m.type === 'play' ? m.card : ''));
    const suggestion = E.coach(state, 0).suggestion as SpadesMove;
    render(<SpadesBoard {...coached(state, { suggestedKey: E.moveKey(suggestion) })} />);
    for (const card of state.hands[0]!) {
      const el = handCard(card);
      if (legal.includes(card)) expect(el).toHaveAttribute('data-highlighted', 'true');
      else expect(el).not.toHaveAttribute('data-highlighted');
    }
    expect(suggestion.type).toBe('play');
    if (suggestion.type === 'play') {
      expect(handCard(suggestion.card)).toHaveAttribute('data-suggested', 'true');
    }
    expect(screen.getByTestId('spades-hand').querySelectorAll('[data-suggested]')).toHaveLength(1);
  });

  it('ignores presses while busy, but the cards stay focusable', () => {
    const state = advance(dealt(), (s) => s.phase === 'play' && s.turn === 1);
    const { onMove } = renderBoard(state);
    expect(screen.getByTestId('spades-hand')).toHaveAttribute('aria-disabled', 'true');
    const card = handCard(state.hands[0]![0]!);
    act(() => card.focus());
    expect(card).toHaveFocus();
    fireEvent.click(card);
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('spades-hand').querySelectorAll('[data-dimmed]')).toHaveLength(0);
  });

  it('lays out the trick by seat, names every card and tags a trump', () => {
    const state = playState({
      hands: [null, null, null, null],
      bids: [3, 2, 3, 2],
      history: ['0: TD 3D AD 2D'],
      trick: '2: KD 3S',
    });
    renderBoard(state);
    const trick = screen.getByTestId('spades-trick');
    expect(trick).toHaveAttribute('data-state', 'playing');
    expect(trick).toHaveAttribute('data-count', '2');
    expect(trick).toHaveAccessibleName(
      'Trick 2 of 13: Mausi Marigold led King of Diamonds, Lady Limelight: Three of Spades',
    );
    expect(
      screen.getByTestId('spades-trick-slot-3').querySelector('[data-card="3S"]'),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId('spades-trick-slot-3')).getByTestId('spades-trick-trump'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('spades-trick-slot-0').querySelector('[data-card]')).toBeNull();
    expect(screen.getByTestId('spades-trick-number')).toHaveTextContent('Trick 2 / 13');
    expect(screen.getByTestId('spades-broken')).toHaveAttribute('data-broken', 'true');
    expect(screen.getByTestId('spades-broken')).toHaveTextContent('Spades broken');
    expect(screen.getByTestId('spades-tricks-2')).toHaveAttribute('data-tricks', '1');
    expect(screen.getByTestId('spades-team-us-progress')).toHaveTextContent('1/6');
  });

  it('glows the winning card of a finished trick, then sweeps it to the winner', () => {
    useSettings.setState({ motion: 'full' });
    vi.useFakeTimers();
    const state = advance(dealt(), (s) => s.tricks.length === 1);
    renderBoard(state);
    const trick = screen.getByTestId('spades-trick');
    expect(trick).toHaveAttribute('data-state', 'complete');
    expect(trick).toHaveAttribute('data-winner', '2');
    expect(screen.getByTestId('spades-trick-slot-2')).toHaveAttribute('data-winner', 'true');
    expect(screen.getByTestId('spades-trick-caption')).toHaveTextContent('Mausi Marigold takes it');
    expect(trick).toHaveAccessibleName(
      'Last trick, won by Mausi Marigold: You led Ten of Diamonds, Stuntman Rafi: Three of Diamonds, Mausi Marigold: Ace of Diamonds, Lady Limelight: Two of Diamonds',
    );
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
    expect(screen.getByTestId('spades-trick')).toHaveAttribute('data-state', 'complete');
  });

  it('marks a made contract on the team panel', () => {
    const state = advance(dealt(), (s) => s.tricks.length === 10);
    renderBoard(state, { busy: true, legalMoves: [] });
    expect(screen.getByTestId('spades-team-us')).toHaveAttribute('data-made', 'true');
    expect(screen.getByTestId('spades-team-us')).toHaveTextContent('Made');
  });

  it('never shows a bot’s cards during play', () => {
    for (const tricks of [0, 3, 7, 12]) {
      const state = advance(
        dealt(),
        (s) => s.phase === 'play' && s.tricks.length === tricks && s.trick.length === 2,
      );
      const { container, unmount } = renderBoard(state);
      expectHidden(container, state);
      unmount();
    }
  });
});

describe('SpadesBoard — the end of the hand', () => {
  it('shows the score breakdown with the winning team', () => {
    const state = advance(dealt(), () => false);
    renderBoard(state);
    const sheet = screen.getByTestId('spades-scores');
    expect(within(sheet).getByText('Final score')).toBeInTheDocument();
    const us = screen.getByTestId('spades-score-us');
    expect(us).toHaveAttribute('data-total', '60');
    expect(us).toHaveAttribute('data-winner', 'true');
    expect(us).toHaveTextContent('You & Mausi Marigold');
    expect(us).toHaveTextContent('6/6');
    expect(us).toHaveTextContent('made');
    expect(within(us).getByRole('rowheader')).toHaveTextContent(/^Us You & Mausi Marigold/);
    const them = screen.getByTestId('spades-score-them');
    expect(within(them).getByRole('rowheader')).toHaveTextContent(
      'Them Stuntman Rafi & Lady Limelight',
    );
    expect(them).toHaveAttribute('data-total', '43');
    expect(them).toHaveAttribute('data-bags', '3');
    expect(them).not.toHaveAttribute('data-winner');
  });

  it('drops the empty hand once every card is played, keeping the learner’s line', () => {
    const state = advance(dealt(), () => false);
    expect(state.hands[0]).toHaveLength(0);
    renderBoard(state);
    expect(screen.getByTestId('spades-hand').parentElement).not.toBeVisible();
    expect(screen.queryByRole('toolbar', { name: 'Your hand' })).not.toBeInTheDocument();
    expect(screen.getByTestId('spades-bid-badge-0')).toHaveAttribute('data-bid', '3');
    expect(screen.getByTestId('spades-tricks-0')).toBeVisible();
    expect(screen.getByTestId('spades-scores')).toBeVisible();
  });

  it('shows a set team and the Nil results', () => {
    // Seat 0 bids Nil and takes no tricks; seat 2 bids 4 and takes 3 (set); 1 & 3 bid 3+3.
    const state = finishedHand({ bids: [0, 3, 4, 3], winners: winnersFor([0, 5, 3, 5]) });
    renderBoard(state);
    const us = screen.getByTestId('spades-score-us');
    expect(us).toHaveAttribute('data-made', 'false');
    expect(us).toHaveTextContent('set');
    expect(us).toHaveTextContent('You: Nil made +100');
    expect(us).toHaveAttribute('data-total', '60');
    expect(screen.getByTestId('spades-score-them')).toHaveAttribute('data-total', '64');
  });
});
