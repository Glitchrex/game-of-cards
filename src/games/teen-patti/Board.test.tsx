// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { useSettings } from '@/store/settings';
import { TeenPattiBoard, type TeenPattiBoardProps } from './Board';
import { teenPattiEngine as E, type TeenPattiMove, type TeenPattiState } from './engine';
import { teenPattiBots } from './personas';
import { TEENPATTI_SEEDS } from './seeds';

const PERSONAS = seatPersonas(teenPattiBots(3));

function props(state: TeenPattiState, extra: Partial<TeenPattiBoardProps> = {}) {
  const current = E.currentPlayer(state);
  const yours = current === 0;
  return {
    state,
    human: 0,
    legalMoves: yours ? E.legalMoves(state, 0) : [],
    onMove: vi.fn<(move: TeenPattiMove) => void>(),
    busy: !yours,
    thinking: current !== null && current !== 0 ? current : null,
    coachMode: false,
    highlight: new Set<string>(),
    suggestedKey: null,
    personas: PERSONAS,
    over: E.isOver(state),
    ...extra,
  } satisfies TeenPattiBoardProps;
}

function renderBoard(state: TeenPattiState, extra: Partial<TeenPattiBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<TeenPattiBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

const play = (s: TeenPattiState, ...types: TeenPattiMove['type'][]) =>
  types.reduce((acc, type) => E.applyMove(acc, { type }), s);

/** The practice deal: dealer seat 1, Bindiya (seat 2) acts first. The learner holds K-K-x. */
const dealt = () => E.setup({ players: 3 }, createRng(TEENPATTI_SEEDS.practice));
/** Bindiya raised blind (stake 2): the learner's turn, still blind. */
const learnerBlind = () => play(dealt(), 'raise');
/** Everyone chaalled once more, the learner saw a Pair of Kings: their turn again. */
const learnerSeen = () => play(learnerBlind(), 'chaal', 'chaal', 'chaal', 'see');
/** Played to the end: Chacha packed, Bindiya asked for a show and lost to the Kings. */
const finished = () => play(learnerSeen(), 'raise', 'see', 'pack', 'see', 'show');

const faceUpCards = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('[data-card]')].map((el) => el.dataset.card);

function expectHidden(container: HTMLElement, cards: readonly CardCode[]) {
  const html = container.innerHTML;
  for (const code of cards) {
    expect(html).not.toContain(cardName(code));
    expect(faceUpCards(container)).not.toContain(code);
  }
}

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

describe('TeenPattiBoard — the table', () => {
  it('seats the bots with their personas, blind badges and three face-down cards each', () => {
    const s = learnerBlind();
    const { container } = renderBoard(s);
    for (const seat of [1, 2]) {
      const persona = PERSONAS[seat]!;
      const el = screen.getByTestId(`tp-seat-${seat}`);
      expect(within(el).getByText(persona.name)).toBeInTheDocument();
      expect(screen.getByTestId(`tp-cards-${seat}`)).toHaveAccessibleName(
        `${persona.name}’s cards: three face-down cards`,
      );
      expect(
        screen.getByTestId(`tp-cards-${seat}`).querySelectorAll('[data-face-down]'),
      ).toHaveLength(3);
    }
    expect(screen.getByTestId('tp-status-1')).toHaveAttribute('data-status', 'blind');
    expect(screen.getByTestId('tp-status-2')).toHaveAttribute('data-status', 'blind');
    expect(screen.getByTestId('tp-dealer-button')).toHaveAttribute('data-seat', String(s.dealer));
    expect(screen.getByTestId('tp-last-2')).toHaveTextContent('Blind raise 2');
    expect(screen.getByTestId('tp-contrib-2')).toHaveAttribute('data-boots', '3');
    // The learner's own cards are face down too while blind — and not in the DOM.
    expect(screen.getByTestId('tp-cards-0')).toHaveAccessibleName(
      'Your cards: three face-down cards — you are playing blind',
    );
    expect(screen.getByTestId('tp-hand-name-0')).toHaveTextContent('Playing blind');
    expect(faceUpCards(container)).toEqual([]);
    expectHidden(container, s.hands.flat());
  });

  it('shows the pot, the stake with blind and seen prices, and the pot-limit meter', () => {
    renderBoard(learnerBlind());
    expect(screen.getByTestId('tp-pot')).toHaveAttribute('data-pot', '5');
    expect(screen.getByTestId('tp-pot')).toHaveTextContent('Pot: 5 boots');
    expect(screen.getByTestId('tp-stake')).toHaveAttribute('data-stake', '2');
    expect(screen.getByText('Blind chaal 2 · Seen chaal 4')).toBeInTheDocument();
    const meter = within(screen.getByTestId('tp-pot-meter')).getByRole('progressbar', {
      name: 'Pot limit',
    });
    expect(meter).toHaveAttribute('aria-valuenow', '5');
    expect(meter).toHaveAttribute('aria-valuemax', '64');
    expect(meter).toHaveAttribute('aria-valuetext', '5 of 64 boots');
  });

  it('prices every bet for the learner: blind now, double once seen', () => {
    renderBoard(learnerBlind());
    expect(screen.getByTestId('tp-chaal')).toHaveTextContent('Chaal · 2');
    expect(screen.getByTestId('tp-chaal')).toHaveAccessibleName('Chaal, costs 2 boots');
    expect(screen.getByTestId('tp-raise')).toHaveTextContent('Raise · 4');
    expect(screen.getByTestId('tp-raise')).toHaveTextContent('Stake → 4');
    expect(screen.getByTestId('tp-show')).toHaveTextContent('Only with 2 left');
    expect(screen.getByTestId('tp-pack')).toHaveAccessibleName('Pack');
  });

  it('every button calls onMove — unavailable ones too, so the coach can explain', () => {
    const { onMove } = renderBoard(learnerBlind());
    for (const type of ['see', 'chaal', 'raise', 'pack'] as const) {
      const button = screen.getByTestId(`tp-${type}`);
      expect(button).toHaveAttribute('data-legal', 'true');
      expect(button).not.toHaveAttribute('aria-disabled');
      fireEvent.click(button);
      expect(onMove).toHaveBeenLastCalledWith({ type });
    }
    // Three players are still in: Show is not available, but it can be attempted.
    const show = screen.getByTestId('tp-show');
    expect(show).not.toHaveAttribute('data-legal');
    expect(show).toHaveAttribute('aria-disabled', 'true');
    expect(show).toHaveAccessibleDescription(/press it and the coach explains why/);
    fireEvent.click(show);
    expect(onMove).toHaveBeenLastCalledWith({ type: 'show' });
    expect(onMove).toHaveBeenCalledTimes(5);
  });

  it('after seeing, the cards are face up with the hand name and seen prices', () => {
    const s = learnerSeen();
    const { container } = renderBoard(s);
    const mine = s.hands[0]!;
    expect(faceUpCards(container).sort()).toEqual([...mine].sort());
    expect(screen.getByTestId('tp-hand-name-0')).toHaveTextContent('Pair of Kings');
    expect(screen.getByTestId('tp-cards-0')).toHaveAccessibleName(
      `Your cards: ${cardName(mine[0]!)}, ${cardName(mine[1]!)} and ${cardName(mine[2]!)} — Pair of Kings`,
    );
    expect(screen.getByTestId('tp-status-0')).toHaveAttribute('data-status', 'seen');
    expect(screen.getByTestId('tp-see')).toHaveTextContent('Cards seen');
    expect(screen.getByTestId('tp-see')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('tp-chaal')).toHaveTextContent('Chaal · 4');
    expect(screen.getByTestId('tp-raise')).toHaveTextContent('Raise · 8');
    // The bots are still blind: their cards stay hidden.
    expectHidden(container, [...s.hands[1]!, ...s.hands[2]!]);
  });

  it('while a bot plays, buttons ignore presses but keep focus, and the seat shows thinking dots', () => {
    const s = dealt(); // Bindiya (seat 2) to act
    const { onMove } = renderBoard(s);
    const seat = screen.getByTestId('tp-persona-2');
    expect(seat).toHaveAttribute('data-thinking', 'true');
    expect(within(seat).getByTestId('thinking-dots')).toBeInTheDocument();
    expect(screen.getByTestId('tp-persona-1')).not.toHaveAttribute('data-thinking');
    expect(screen.getByTestId('tp-seat-2')).toHaveAttribute('data-active', 'true');
    const chaal = screen.getByTestId('tp-chaal');
    expect(chaal).toHaveAttribute('aria-disabled', 'true');
    expect(chaal).toHaveAccessibleDescription(/Waiting for Bindiya Bioscope/);
    chaal.focus();
    fireEvent.click(chaal);
    fireEvent.keyDown(document.body, { key: 'c' });
    expect(onMove).not.toHaveBeenCalled();
    expect(chaal).toHaveFocus();
  });

  it('busy on the learner’s own turn (an animation) never says "Waiting for You"', () => {
    const { container } = renderBoard(learnerBlind(), { busy: true, thinking: null });
    const chaal = screen.getByTestId('tp-chaal');
    expect(chaal).toHaveAccessibleDescription(/One moment…/);
    expect(container).not.toHaveTextContent(/Waiting for You/);
  });

  it('keeps the shared button descriptions out of the reading order', () => {
    const { container } = renderBoard(learnerBlind());
    const show = screen.getByTestId('tp-show');
    expect(show).toHaveAccessibleDescription(/press it and the coach explains why/);
    const ids = show.getAttribute('aria-describedby')!.split(' ');
    const shared = container.querySelector<HTMLElement>(`[id="${ids[1]}"]`)!;
    expect(shared).not.toBeVisible();
    // The raise hint reads in words, not "Stake right arrow 4".
    expect(screen.getByTestId('tp-raise')).toHaveAccessibleDescription(/The stake goes up to 4/);
    // The pot is named once: the visible "Pot" caption is hidden from screen readers.
    expect(screen.getByTestId('tp-pot')).toHaveTextContent('Pot: 5 boots');
    expect(within(screen.getByTestId('tp-pot')).getByText('Pot')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('marks the learner’s seat active on their turn', () => {
    renderBoard(learnerBlind());
    expect(screen.getByTestId('tp-seat-0')).toHaveAttribute('data-active', 'true');
    expect(within(screen.getByTestId('tp-persona-0')).getByText('Your turn')).toBeInTheDocument();
  });
});

describe('TeenPattiBoard — keyboard', () => {
  it('S / C / R / W / P work anywhere on the page', () => {
    const { onMove } = renderBoard(learnerBlind());
    const keys = { s: 'see', c: 'chaal', r: 'raise', w: 'show', p: 'pack' } as const;
    for (const [key, type] of Object.entries(keys)) {
      fireEvent.keyDown(document.body, { key });
      expect(onMove).toHaveBeenLastCalledWith({ type });
    }
    fireEvent.keyDown(document.body, { key: 'C' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'chaal' });
    expect(onMove).toHaveBeenCalledTimes(6);
    for (const type of ['see', 'chaal', 'raise', 'show', 'pack']) {
      expect(screen.getByTestId(`tp-${type}`)).toHaveAttribute('aria-keyshortcuts');
    }
  });

  it('ignores shortcuts with modifiers, on key repeat, while typing and inside other dialogs', () => {
    const { onMove } = renderBoard(learnerBlind());
    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'c', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'c', repeat: true });
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'c' });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const inside = document.createElement('button');
    dialog.appendChild(inside);
    document.body.appendChild(dialog);
    fireEvent.keyDown(inside, { key: 'p' });
    expect(onMove).not.toHaveBeenCalled();
    input.remove();
    dialog.remove();
  });

  it('←/→, Home and End move between the action buttons; Enter and Space press them', () => {
    const { onMove } = renderBoard(learnerBlind());
    const order = ['see', 'chaal', 'raise', 'show', 'pack'].map((x) =>
      screen.getByTestId(`tp-${x}`),
    );
    order[0]!.focus();
    for (let i = 1; i < order.length; i++) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      expect(order[i]).toHaveFocus();
    }
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(order[0]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(order[4]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(order[0]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(order[4]).toHaveFocus();
    // Native buttons: Enter / Space fire a click.
    expect(order.every((b) => b.tagName === 'BUTTON' && b.getAttribute('type') === 'button')).toBe(
      true,
    );
    fireEvent.click(order[1]!);
    expect(onMove).toHaveBeenLastCalledWith({ type: 'chaal' });
  });

  it('the action buttons come in a logical tab order: See, Chaal, Raise, Show, Pack', () => {
    renderBoard(learnerBlind());
    const buttons = [...document.querySelectorAll<HTMLElement>('[data-tp-action]')];
    expect(buttons.map((b) => b.dataset.tpAction)).toEqual([
      'see',
      'chaal',
      'raise',
      'show',
      'pack',
    ]);
    for (const b of buttons) expect(b.tabIndex).toBe(0);
  });
});

describe('TeenPattiBoard — coach mode', () => {
  it('legal moves glow only in coach mode; the coach’s pick pulses', () => {
    const s = learnerBlind();
    const highlight = new Set(E.legalMoves(s, 0).map((m) => E.moveKey(m)));
    const plain = renderBoard(s, { highlight });
    expect(document.querySelectorAll('[data-highlighted]')).toHaveLength(0);
    plain.unmount();

    renderBoard(s, { coachMode: true, highlight, suggestedKey: 'chaal' });
    for (const type of ['see', 'chaal', 'raise', 'pack']) {
      expect(screen.getByTestId(`tp-${type}`)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.getByTestId('tp-show')).not.toHaveAttribute('data-highlighted');
    expect(screen.getByTestId('tp-chaal')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('tp-chaal')).toHaveAccessibleDescription(/The coach’s pick/);
    expect(within(screen.getByTestId('tp-chaal')).getByTestId('tp-suggested-ring')).toBeTruthy();
    expect(screen.getByTestId('tp-see')).not.toHaveAttribute('data-suggested');
  });
});

describe('TeenPattiBoard — the end of the hand', () => {
  it('turns up the hands at the show, names them and crowns the winner; packed cards stay hidden', () => {
    const s = finished();
    expect(s.outcome).toMatchObject({ kind: 'show', winners: [0], showdown: [0, 2] });
    const { container } = renderBoard(s);
    expect(faceUpCards(container).sort()).toEqual([...s.hands[0]!, ...s.hands[2]!].sort());
    expect(screen.getByTestId('tp-hand-name-2')).toHaveTextContent('Pair of Fours');
    expect(screen.getByTestId('tp-hand-name-0')).toHaveTextContent('Pair of Kings');
    expect(screen.getByTestId('tp-winner-0')).toHaveAttribute('data-boots', '27');
    expect(screen.getByTestId('tp-seat-0')).toHaveAttribute('data-winner', 'true');
    expect(screen.queryByTestId('tp-winner-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('tp-outcome')).toHaveAttribute('data-kind', 'show');
    expect(screen.getByTestId('tp-pot')).toHaveAttribute('data-collected', 'true');
    // Chacha packed: his cards are never turned over.
    expect(screen.getByTestId('tp-status-1')).toHaveAttribute('data-status', 'packed');
    expect(screen.getByTestId('tp-cards-1')).toHaveAccessibleName(
      'Chacha Chaalbaaz’s cards: packed — their cards are out of the hand',
    );
    expectHidden(container, s.hands[1]!);
    // Once the hand is over the bet buttons stop quoting live hints and point to the next hand.
    expect(screen.getByTestId('tp-chaal')).toHaveAccessibleDescription(
      'Hand over Start a new hand to play again.',
    );
    expect(screen.getByTestId('tp-pot')).toHaveTextContent('Pot: 27 boots, paid to the winner');
  });

  it('a last-standing win shows no one else’s cards', () => {
    const start = E.setup({ players: 3 }, createRng(TEENPATTI_SEEDS.everyonePacks));
    // Seat 1 chaals, seat 2 chaals, the learner chaals, seat 1 sees and packs, seat 2 sees and packs.
    const s = play(start, 'chaal', 'chaal', 'chaal', 'see', 'pack', 'see', 'pack');
    expect(s.outcome?.kind).toBe('last-standing');
    const { container } = renderBoard(s);
    expectHidden(container, [...s.hands[1]!, ...s.hands[2]!]);
    // The learner played blind; at the end they get to see what they had.
    expect(faceUpCards(container).sort()).toEqual([...s.hands[0]!].sort());
    expect(screen.getByTestId('tp-winner-0')).toBeInTheDocument();
    expect(screen.getByTestId('tp-outcome')).toHaveAttribute('data-kind', 'last-standing');
    // Their cards are face up now, but they never looked: the See button says so.
    expect(screen.getByTestId('tp-see')).toHaveAccessibleName('Cards shown');
    expect(screen.getByTestId('tp-see')).toHaveTextContent('You played this hand blind');
  });

  it('a pot-limit showdown says the betting is over, not "Ends the betting"', () => {
    let s = E.setup({ players: 3 }, createRng(TEENPATTI_SEEDS.potLimit));
    for (let i = 0; i < 200 && !E.isOver(s); i++) {
      const legal = E.legalMoves(s, E.currentPlayer(s)!);
      const move = legal.find((m) => m.type === 'chaal') ?? legal[0]!;
      s = E.applyMove(s, move);
    }
    expect(s.outcome?.kind).toBe('pot-limit');
    renderBoard(s);
    for (const id of ['tp-chaal', 'tp-raise', 'tp-show']) {
      expect(screen.getByTestId(id)).toHaveTextContent('Hand over');
      expect(screen.getByTestId(id)).not.toHaveTextContent(/Ends the betting|Stake at the limit/);
    }
  });
});

describe('TeenPattiBoard — motion', () => {
  it('deals one card at a time from the deck, starting on the dealer’s left, and turns seen cards over', async () => {
    useSettings.setState({ motion: 'full' });
    vi.useFakeTimers();
    const s = learnerSeen();
    const { container } = renderBoard(s);
    // Mid-deal, nothing is face up yet.
    expect(faceUpCards(container)).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(faceUpCards(container).sort()).toEqual([...s.hands[0]!].sort());
  });

  it('deals again when a new hand starts (the practice "Try another" restart)', () => {
    const first = learnerSeen();
    const p = props(first);
    const view = render(<TeenPattiBoard {...p} />);
    expect(faceUpCards(view.container)).toHaveLength(3);
    const next = E.setup({ players: 3 }, createRng(TEENPATTI_SEEDS.practice + 1));
    view.rerender(<TeenPattiBoard {...props(next)} />);
    expect(faceUpCards(view.container)).toEqual([]);
    expect(screen.getByTestId('tp-pot')).toHaveAttribute('data-pot', '3');
  });
});
