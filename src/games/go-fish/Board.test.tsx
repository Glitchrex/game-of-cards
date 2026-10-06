// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { useSettings } from '@/store/settings';
import { SPLASH_MS } from './board/Pond';
import { GoFishBoard, type GoFishBoardProps } from './Board';
import { goFishEngine as E, type GoFishMove, type GoFishState } from './engine';
import goFishModule from './index';
import { GOFISH_SEEDS } from './seeds';
import { makeState, type StateSpec } from './test-helpers';

const PERSONAS = seatPersonas(goFishModule.bots);
const [, MIRA, KANTA] = PERSONAS;

function props(state: GoFishState, extra: Partial<GoFishBoardProps> = {}) {
  const current = E.currentPlayer(state);
  const yours = current === 0;
  return {
    state,
    human: 0,
    legalMoves: yours ? E.legalMoves(state, 0) : [],
    onMove: vi.fn<(move: GoFishMove) => void>(),
    busy: !yours,
    thinking: current !== null && current !== 0 ? current : null,
    coachMode: false,
    highlight: new Set<string>(),
    suggestedKey: null,
    personas: PERSONAS,
    over: E.isOver(state),
    ...extra,
  } satisfies GoFishBoardProps;
}

/** Board props as the controller builds them in coach mode (every legal move highlighted). */
function coached(state: GoFishState, extra: Partial<GoFishBoardProps> = {}) {
  const base = props(state);
  return props(state, {
    coachMode: true,
    highlight: new Set(base.legalMoves.map((m) => E.moveKey(m))),
    ...extra,
  });
}

function renderBoard(state: GoFishState, extra: Partial<GoFishBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<GoFishBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

/**
 * You: 7♠ 7♥ K♦ 4♣. Machli Mira (seat 1): 7♣ 2♠ 9♦. Kanta Kaka (seat 2): K♠ K♥ 2♥ 5♦.
 * The pond starts 9♠ 3♣.
 */
const table = (extra: Partial<StateSpec> = {}) =>
  makeState({
    hands: ['7S 7H KD 4C', '7C 2S 9D', 'KS KH 2H 5D'],
    stock: '9S 3C',
    ...extra,
  });

const ask = (target: number, rank: GoFishMove['rank']): GoFishMove => ({
  type: 'ask',
  target,
  rank,
});

/** Every card the learner must not see: the bots' hands and the pond. */
function expectHidden(container: HTMLElement, state: GoFishState) {
  const html = container.innerHTML;
  const secrets: CardCode[] = [
    ...(state.hands[1] ?? []),
    ...(state.hands[2] ?? []),
    ...state.stock,
  ];
  for (const code of secrets) {
    expect(html).not.toContain(`data-card="${code}"`);
    expect(html).not.toContain(cardName(code));
  }
}

const rankButton = (rank: string) => screen.getByTestId(`gofish-rank-${rank}`);

/** Let motion finish its (instant, reduced-motion) exit animations inside act(). */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

/** Focus inside act(): the roving toolbars remember the focused button in state. */
function focus(el: HTMLElement) {
  act(() => el.focus());
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

describe('GoFishBoard — the table', () => {
  it('seats the bots with names, card counts and books; their cards and the pond stay hidden', () => {
    const state = table({ books: ['', 'A', ''] });
    const { container } = renderBoard(state);
    expect(within(screen.getByTestId('gofish-seat-1')).getByText(MIRA!.name)).toBeInTheDocument();
    expect(within(screen.getByTestId('gofish-seat-2')).getByText(KANTA!.name)).toBeInTheDocument();
    expect(screen.getByTestId('gofish-count-1')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('gofish-count-2')).toHaveTextContent('4 cards');
    expect(
      within(screen.getByTestId('gofish-seat-1')).getByRole('img', {
        name: 'Machli Mira holds 3 cards',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('gofish-books-1')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('gofish-books-1')).toHaveAccessibleName('Machli Mira’s books: Aces');
    expect(screen.getByTestId('gofish-books-2')).toHaveAccessibleName(
      'Kanta Kaka has no books yet',
    );
    const pond = screen.getByTestId('gofish-pond');
    expect(pond).toHaveAttribute('data-count', String(state.stock.length));
    expect(pond).toHaveAccessibleName(`The pond: ${state.stock.length} cards face down`);
    expectHidden(container, state);
  });

  it('groups your hand by rank, one button per rank, named with its cards', () => {
    renderBoard(table());
    const hand = screen.getByTestId('gofish-hand');
    expect(hand).toHaveAttribute('role', 'toolbar');
    expect(hand).toHaveAttribute('data-count', '4');
    expect(
      within(hand)
        .getAllByRole('button')
        .map((b) => b.dataset.testid),
    ).toEqual(['gofish-rank-4', 'gofish-rank-7', 'gofish-rank-K']);
    expect(rankButton('7')).toHaveAttribute('data-count', '2');
    expect(rankButton('7')).toHaveAccessibleName('Sevens: Seven of Spades and Seven of Hearts');
    expect(rankButton('7')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('gofish-books-0')).toHaveAccessibleName('You have no books yet');
  });

  it('pick a player, pick a rank, Ask: the sentence previews the ask and onMove gets it', () => {
    const { onMove } = renderBoard(table());
    const askBtn = screen.getByTestId('gofish-ask');
    expect(askBtn).toHaveTextContent('Pick a player and a rank');
    expect(askBtn).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(screen.getByTestId('gofish-target-2'));
    expect(screen.getByTestId('gofish-target-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('gofish-target-1')).toHaveAttribute('aria-pressed', 'false');
    expect(askBtn).toHaveTextContent('Now pick a rank from your hand');

    fireEvent.click(rankButton('K'));
    expect(rankButton('K')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('gofish-preview')).toHaveTextContent('Ask Kanta Kaka for Kings');
    expect(askBtn).toHaveAttribute('data-ready', 'true');
    expect(askBtn).not.toHaveAttribute('aria-disabled');

    fireEvent.click(askBtn);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(ask(2, 'K'));
  });

  it('lets the learner attempt an incomplete ask, or ask a player with no cards (the coach explains)', () => {
    const full = table();
    const first = renderBoard(full);
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(first.onMove).toHaveBeenLastCalledWith({ type: 'ask', target: -1, rank: '' });
    expect(E.checkMove(full, 0, vi.mocked(first.onMove).mock.lastCall![0]).reason).toMatch(
      /Pick one of the/,
    );
    fireEvent.click(screen.getByTestId('gofish-target-1'));
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(first.onMove).toHaveBeenLastCalledWith({ type: 'ask', target: 1, rank: '' });
    expect(E.checkMove(full, 0, vi.mocked(first.onMove).mock.lastCall![0]).reason).toMatch(
      /Pick a rank to ask for/,
    );
    first.unmount();

    const state = table({ hands: ['7S 7H KD 4C', '', 'KS KH 2H 5D 7C 2S 9D'] });
    const { onMove } = renderBoard(state);
    const empty = screen.getByTestId('gofish-target-1');
    expect(empty).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('gofish-count-1')).toHaveTextContent('Out of cards');
    fireEvent.click(empty);
    fireEvent.click(rankButton('7'));
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(onMove).toHaveBeenLastCalledWith(ask(1, '7'));
    expect(E.checkMove(state, 0, ask(1, '7')).ok).toBe(false);
  });

  it('with only one player left to ask, that player is picked for you', () => {
    const { onMove } = renderBoard(
      makeState({ hands: ['7S 7H KD 4C', '7C 2S 9D'], stock: '9S 3C' }),
    );
    expect(screen.queryByTestId('gofish-target-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('gofish-target-1')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(rankButton('4'));
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(onMove).toHaveBeenCalledWith(ask(1, '4'));
  });

  it('a rank pick lasts until the next move; the player you picked stays picked', async () => {
    const state = table();
    const p = props(state);
    const { rerender } = render(<GoFishBoard {...p} />);
    fireEvent.click(screen.getByTestId('gofish-target-1'));
    fireEvent.click(rankButton('7'));
    const next = E.applyMove(state, ask(1, '7'));
    rerender(<GoFishBoard {...props(next)} />);
    await settle();
    expect(rankButton('7')).toHaveAttribute('aria-pressed', 'false');
    expect(rankButton('7')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('gofish-target-1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('gofish-preview')).toHaveTextContent('Now pick a rank');
  });

  it('shows a bot thinking with dots and its seat glowing; presses wait, focus stays', () => {
    const state = table({ turn: 2 });
    const { onMove } = renderBoard(state, { thinking: 2, busy: true });
    const seat = screen.getByTestId('gofish-seat-2');
    expect(seat).toHaveAttribute('data-thinking', 'true');
    expect(seat).toHaveAttribute('data-active', 'true');
    expect(within(seat).getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByTestId('gofish-you-status')).toHaveTextContent('Kanta Kaka’s turn');
    const seven = rankButton('7');
    expect(seven).toHaveAttribute('aria-disabled', 'true');
    focus(seven);
    fireEvent.click(seven);
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(seven).toHaveFocus();
    expect(seven).toHaveAttribute('aria-pressed', 'false');
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('gofish-ask')).toHaveAccessibleDescription(
      'Wait — it’s Kanta Kaka’s turn.',
    );
  });
  it('sizes each rank group to its cards, so cards never spill over the next group', () => {
    renderBoard(table());
    // The buttons shrink to fit their content: a `min(100%, …)` row width would collapse
    // (the row is a size container) and the fanned cards would overlap the next group.
    for (const rank of ['4', '7', 'K']) {
      const row = screen.getByTestId(`gofish-cards-${rank}`);
      expect(row.style.width).toMatch(/^calc\(/);
      expect(row.style.width).not.toContain('min(');
    }
  });

  it('shows the player you picked only on your turn, and keeps them for your next one', async () => {
    const state = table();
    const { rerender } = render(<GoFishBoard {...props(state)} />);
    fireEvent.click(screen.getByTestId('gofish-target-2'));
    // You ask Kanta Kaka for Fours: Go Fish (you draw the Nine of Spades), Mira's turn.
    const botTurn = E.applyMove(state, ask(2, '4'));
    expect(E.currentPlayer(botTurn)).toBe(1);
    rerender(<GoFishBoard {...props(botTurn)} />);
    await settle();
    const kanta = screen.getByTestId('gofish-target-2');
    expect(kanta).toHaveAttribute('aria-pressed', 'false');
    expect(within(kanta).queryByText('Asking')).not.toBeInTheDocument();
    let mine = botTurn;
    const rng = createRng('picked-seat');
    while (E.currentPlayer(mine) !== 0) {
      const seat = E.currentPlayer(mine) ?? 0;
      mine = E.applyMove(mine, E.botMove(mine, seat, 'normal', rng));
    }
    expect((mine.hands[2] ?? []).length).toBeGreaterThan(0);
    rerender(<GoFishBoard {...props(mine)} />);
    await settle();
    expect(screen.getByTestId('gofish-target-2')).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('gofish-target-2')).getByText('Asking')).toBeVisible();
  });

  it('says “Out of cards” once on an empty seat', () => {
    renderBoard(table({ hands: ['7S 7H KD 4C', '', 'KS KH 2H 5D 7C 2S 9D'] }));
    expect(within(screen.getByTestId('gofish-seat-1')).getAllByText('Out of cards')).toHaveLength(
      1,
    );
  });
});

describe('GoFishBoard — keyboard', () => {
  it('Tab: seats (one stop) → hand (one stop) → Ask; arrows move, Enter/Space pick', () => {
    const { onMove } = renderBoard(table());
    const seat1 = screen.getByTestId('gofish-target-1');
    const seat2 = screen.getByTestId('gofish-target-2');
    expect(seat1).toHaveAttribute('tabindex', '0');
    expect(seat2).toHaveAttribute('tabindex', '-1');
    focus(seat1);
    fireEvent.keyDown(seat1, { key: 'ArrowRight' });
    expect(seat2).toHaveFocus();
    expect(seat2).toHaveAttribute('tabindex', '0');
    // Enter on a button is a click.
    fireEvent.click(seat2);
    expect(seat2).toHaveAttribute('aria-pressed', 'true');

    const tabStops = [...document.querySelectorAll<HTMLElement>('button')].filter(
      (b) => b.tabIndex >= 0,
    );
    expect(tabStops.map((b) => b.dataset.testid)).toEqual([
      'gofish-target-2',
      'gofish-rank-4',
      'gofish-ask',
    ]);

    const four = rankButton('4');
    focus(four);
    fireEvent.keyDown(four, { key: 'End' });
    expect(rankButton('K')).toHaveFocus();
    fireEvent.keyDown(rankButton('K'), { key: 'ArrowLeft' });
    expect(rankButton('7')).toHaveFocus();
    fireEvent.keyDown(rankButton('7'), { key: 'Home' });
    expect(four).toHaveFocus();
    fireEvent.click(rankButton('K'));
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(onMove).toHaveBeenCalledWith(ask(2, 'K'));
  });

  it('rank keys pick a rank from anywhere — even one you don’t hold, so the coach can explain', () => {
    const { onMove } = renderBoard(table());
    fireEvent.click(screen.getByTestId('gofish-target-1'));
    fireEvent.keyDown(document.body, { key: 'k' });
    expect(rankButton('K')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document.body, { key: '7' });
    expect(rankButton('7')).toHaveAttribute('aria-pressed', 'true');
    expect(rankButton('K')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(document.body, { key: 'q' });
    expect(screen.getByTestId('gofish-preview')).toHaveTextContent('Ask Machli Mira for Queens');
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(onMove).toHaveBeenCalledWith(ask(1, 'Q'));
    fireEvent.keyDown(document.body, { key: '0' });
    expect(screen.getByTestId('gofish-preview')).toHaveTextContent('for Tens');
  });

  it('ignores rank keys while typing, with modifiers, and while it is not your turn', () => {
    const { unmount } = renderBoard(table());
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: '7' });
    fireEvent.keyDown(document.body, { key: '7', ctrlKey: true });
    expect(rankButton('7')).toHaveAttribute('aria-pressed', 'false');
    input.remove();
    unmount();

    renderBoard(table({ turn: 1 }));
    fireEvent.keyDown(document.body, { key: '7' });
    expect(rankButton('7')).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps focus in the hand when the focused rank group is handed over', async () => {
    const state = table({ turn: 1 });
    const { rerender } = render(<GoFishBoard {...props(state)} />);
    const seven = rankButton('7');
    focus(seven);
    // Machli Mira asks you for Sevens: both of yours go.
    const next = E.applyMove(state, ask(0, '7'));
    rerender(<GoFishBoard {...props(next)} />);
    await settle();
    expect(screen.queryByTestId('gofish-rank-7')).not.toBeInTheDocument();
    expect(screen.getByTestId('gofish-hand')).toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});

describe('GoFishBoard — coach mode', () => {
  it('legal seats and ranks glow; nothing glows outside coach mode', () => {
    const state = table();
    const { unmount } = render(<GoFishBoard {...coached(state)} />);
    for (const id of ['gofish-target-1', 'gofish-target-2', 'gofish-rank-4', 'gofish-rank-7']) {
      expect(screen.getByTestId(id)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.getByTestId('gofish-ask')).not.toHaveAttribute('data-highlighted');
    fireEvent.click(screen.getByTestId('gofish-target-1'));
    fireEvent.click(rankButton('7'));
    expect(screen.getByTestId('gofish-ask')).toHaveAttribute('data-highlighted', 'true');
    unmount();

    renderBoard(state);
    expect(document.querySelector('[data-highlighted]')).toBeNull();
  });

  it('the coach’s pick pulses on its seat and rank; “Use the coach’s pick” fills it in', () => {
    const state = table();
    const pick = E.coach(state, 0).suggestion as GoFishMove;
    const p = coached(state, { suggestedKey: E.moveKey(pick) });
    render(<GoFishBoard {...p} />);
    expect(screen.getByTestId(`gofish-target-${pick.target}`)).toHaveAttribute(
      'data-suggested',
      'true',
    );
    expect(rankButton(pick.rank)).toHaveAttribute('data-suggested', 'true');
    expect(rankButton(pick.rank)).toHaveAccessibleDescription('The coach’s pick');
    expect(document.querySelectorAll('[data-suggested]')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('gofish-use-pick'));
    expect(screen.getByTestId('gofish-ask')).toHaveAttribute('data-suggested', 'true');
    expect(screen.queryByTestId('gofish-use-pick')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(p.onMove).toHaveBeenCalledWith(pick);
  });
});

describe('GoFishBoard — what just happened', () => {
  it('a catch: “Catch! +1”, the bubble says who handed over what, the group is tagged New', async () => {
    const state = table();
    const { rerender } = render(<GoFishBoard {...props(state)} />);
    expect(screen.queryByTestId('gofish-splash')).not.toBeInTheDocument();
    rerender(<GoFishBoard {...props(E.applyMove(state, ask(1, '7')))} />);
    await settle();
    expect(screen.getByTestId('gofish-splash')).toHaveAttribute('data-kind', 'catch');
    expect(screen.getByTestId('gofish-splash')).toHaveTextContent('Catch! +1');
    expect(screen.getByTestId('gofish-last-ask')).toHaveTextContent(
      'You asked Machli Mira for Sevens',
    );
    expect(screen.getByTestId('gofish-last-ask')).toHaveTextContent(
      'Machli Mira handed over one Seven.',
    );
    expect(rankButton('7')).toHaveAttribute('data-fresh', 'true');
    expect(screen.getByTestId('gofish-you-status')).toHaveTextContent('Go again!');
  });

  it('“GO FISH!” splashes, then clears itself', async () => {
    vi.useFakeTimers();
    const state = table();
    const { rerender } = render(<GoFishBoard {...props(state)} />);
    rerender(<GoFishBoard {...props(E.applyMove(state, ask(2, '4')))} />);
    expect(screen.getByTestId('gofish-splash')).toHaveAttribute('data-kind', 'fish');
    expect(screen.getByTestId('gofish-splash')).toHaveTextContent('Go Fish!');
    expect(screen.getByTestId('gofish-last-ask')).toHaveTextContent('Go Fish!');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SPLASH_MS + 200);
    });
    expect(screen.queryByTestId('gofish-splash')).not.toBeInTheDocument();
    // Your own draw is yours to see: the Nine of Spades joins your hand.
    expect(rankButton('9')).toHaveAttribute('data-fresh', 'true');
  });

  it('a bot’s Go Fish draw never reaches the page', async () => {
    const state = table({ turn: 1 });
    const { rerender, container } = render(<GoFishBoard {...props(state)} />);
    const next = E.applyMove(state, ask(0, '2'));
    const drawn = next.log.find((e) => e.type === 'fish');
    expect(drawn).toMatchObject({ seat: 1, card: '9S', wish: false });
    rerender(<GoFishBoard {...props(next)} />);
    await settle();
    expect(screen.getByTestId('gofish-last-ask')).toHaveTextContent(
      'Machli Mira asked you for Twos',
    );
    expectHidden(container, next);
    expect(screen.getByTestId('gofish-count-1')).toHaveAttribute('data-count', '4');
  });

  it('a book made from your hand moves to your book area', async () => {
    const state = makeState({
      hands: ['7S 7H 7D KD', '7C 2S 9D', 'KS KH 2H 5D'],
      stock: '9S 3C',
    });
    const { rerender } = render(<GoFishBoard {...props(state)} />);
    rerender(<GoFishBoard {...props(E.applyMove(state, ask(1, '7')))} />);
    await settle();
    expect(screen.queryByTestId('gofish-rank-7')).not.toBeInTheDocument();
    const books = screen.getByTestId('gofish-books-0');
    expect(books).toHaveAttribute('data-count', '1');
    expect(books).toHaveAccessibleName('Your books: Sevens');
    expect(within(books).getByTestId('gofish-book-7')).toBeInTheDocument();
    expect(screen.getByTestId('gofish-you-count')).toHaveTextContent('1 book');
  });

  it('at the end, the winners wear the trophy', () => {
    let s = E.setup(goFishModule.defaultConfig, createRng(GOFISH_SEEDS.practice));
    const rng = createRng('board-test');
    while (!E.isOver(s)) {
      const seat = E.currentPlayer(s) ?? 0;
      s = E.applyMove(
        s,
        seat === 0 ? (E.coach(s, 0).suggestion as GoFishMove) : E.botMove(s, seat, 'normal', rng),
      );
    }
    renderBoard(s);
    expect(screen.getByTestId('gofish-board')).toHaveAttribute('data-phase', 'over');
    expect(screen.getByTestId('gofish-you')).toHaveAttribute('data-winner', 'true');
    expect(screen.getByTestId('gofish-seat-1')).not.toHaveAttribute('data-winner');
    expect(screen.getByTestId('gofish-books-0')).toHaveAttribute('data-count', '5');
    expect(screen.getByTestId('gofish-pond')).toHaveAccessibleName('The pond is empty');
    expect(screen.getByTestId('gofish-you-status')).toHaveTextContent('Game over');
  });

  it('a new deal remounts the table: picks are cleared', async () => {
    const first = E.setup(goFishModule.defaultConfig, createRng(1));
    const { rerender } = render(<GoFishBoard {...props(first)} />);
    fireEvent.click(screen.getByTestId('gofish-target-2'));
    const second = E.setup(goFishModule.defaultConfig, createRng(2));
    rerender(<GoFishBoard {...props(second)} />);
    await settle();
    expect(screen.getByTestId('gofish-target-2')).toHaveAttribute('aria-pressed', 'false');
  });
});
