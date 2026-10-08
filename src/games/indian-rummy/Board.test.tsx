// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { useSettings } from '@/store/settings';
import { IndianRummyBoard, type IndianRummyBoardProps } from './Board';
import {
  bestArrangement,
  indianRummyEngine as E,
  type IndianRummyMove,
  type IndianRummyState,
} from './engine';
import { DADI_DIAMOND, INDIAN_RUMMY_BOTS } from './personas';
import { buildState, cards } from './test-helpers';

const PERSONAS = seatPersonas(INDIAN_RUMMY_BOTS);
const WILD: CardCode = '7D';

/** 13 cards: a pure sequence, a set, a sequence held by a wild 7 and four loose cards. */
const MINE = cards('4H 5H 6H 9S 9D 9C JC QC 7S 2S KD 3C 5D');
/** Dadi's cards — none of them appear anywhere else on the table. */
const THEIRS = cards('AS AH AC 2H 3H 8S 8C TS TH TD QS KS 6C');
/** 14 cards that declare by throwing the K♦. */
const COMPLETE = cards('4H 5H 6H 2S 3S 4S 9S 9D 9C 9H JC QC 7S KD');

function drawState(extra: Partial<Parameters<typeof buildState>[0]> = {}): IndianRummyState {
  return buildState({
    hands: [MINE, THEIRS],
    wildCard: WILD,
    discard: ['4D'],
    stockTop: ['KH'],
    dealer: 1,
    ...extra,
  });
}

function completeState(): IndianRummyState {
  return buildState({
    hands: [COMPLETE, THEIRS],
    wildCard: WILD,
    discard: ['4D'],
    stockTop: ['KH'],
    phase: 'discard',
    hasDrawn: [true, true],
    turnsTaken: [2, 2],
    drawn: { from: 'stock', card: 'KD' },
  });
}

function props(state: IndianRummyState, extra: Partial<IndianRummyBoardProps> = {}) {
  const yours = E.currentPlayer(state) === 0;
  return {
    state,
    human: 0,
    legalMoves: yours ? E.legalMoves(state, 0) : [],
    onMove: vi.fn<(m: IndianRummyMove) => void>(),
    busy: !yours,
    thinking: !E.isOver(state) && !yours ? E.currentPlayer(state) : null,
    coachMode: false,
    highlight: new Set<string>(),
    suggestedKey: null,
    personas: PERSONAS,
    over: E.isOver(state),
    ...extra,
  } satisfies IndianRummyBoardProps;
}

function renderBoard(state: IndianRummyState, extra: Partial<IndianRummyBoardProps> = {}) {
  const onMove = vi.fn<(m: IndianRummyMove) => void>();
  const p = props(state, { onMove, ...extra });
  const view = render(<IndianRummyBoard {...p} />);
  return { ...view, onMove, props: p };
}

const cardButtons = (code: CardCode) =>
  within(screen.getByTestId('rummy-hand'))
    .getAllByTestId('rummy-card')
    .filter((el) => el.getAttribute('data-card') === code);
const cardButton = (code: CardCode) => cardButtons(code)[0]!;

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  // Cards land instantly; flights are exercised in the integration tests.
  useSettings.setState({ motion: 'reduce' });
});

describe('IndianRummyBoard — what is on the table', () => {
  it('shows Dadi Diamond with 13 card backs, and none of her cards or the stock in the DOM', () => {
    const { container } = renderBoard(drawState());
    const seat = screen.getByTestId('rummy-seat-1');
    expect(within(seat).getByText(DADI_DIAMOND.name)).toBeInTheDocument();
    expect(within(seat).getByText(DADI_DIAMOND.tagline)).toBeInTheDocument();
    const theirs = screen.getByTestId('rummy-opponent-hand-1');
    expect(theirs).toHaveAttribute('data-revealed', 'false');
    expect(theirs).toHaveAccessibleName('Dadi Diamond’s hand: 13 cards');

    // Faces on the table: the learner's 13, the open card and the wild-joker card. Nothing else.
    const faces = [...container.querySelectorAll('[data-card]')].map((el) =>
      el.getAttribute('data-card'),
    );
    expect(faces.sort()).toEqual([...MINE, '4D', WILD, WILD].sort());
    const html = container.innerHTML;
    for (const secret of [...THEIRS, 'KH'] as CardCode[]) {
      expect(html).not.toContain(cardName(secret));
      expect(html).not.toContain(`"${secret}"`);
    }
  });

  it('labels the stock, the open pile and the wild-joker card', () => {
    renderBoard(drawState());
    expect(screen.getByTestId('rummy-stock')).toHaveAccessibleName(
      `Closed stock — draw a card, ${drawState().stock.length} cards`,
    );
    expect(screen.getByTestId('rummy-discard-pile')).toHaveAccessibleName(
      'Open pile — take the top card, 1 card, top card Four of Diamonds',
    );
    expect(screen.getByTestId('rummy-wild')).toHaveAccessibleName(
      'Wild joker: Seven of Diamonds. All 7s are jokers. Nobody can take this card.',
    );
    expect(screen.getByTestId('rummy-wild-label')).toHaveTextContent(
      'Wild joker: all 7s are jokers',
    );
  });

  it('says when a printed joker is the wild-joker card: Aces are wild', () => {
    renderBoard(drawState({ wildCard: 'X1' }));
    expect(screen.getByTestId('rummy-wild-label')).toHaveTextContent(
      'Wild joker: all Aces are jokers',
    );
  });

  it('lays the hand out in the groups bestArrangement finds, with labels and a points counter', () => {
    const state = drawState();
    renderBoard(state);
    const best = bestArrangement(MINE, state.wildRank);
    const groups = screen.getAllByTestId('rummy-group');
    expect(groups.map((g) => g.dataset.kind)).toEqual(best.groups.map((g) => g.kind));
    for (const [i, g] of best.groups.entries()) {
      expect(
        within(groups[i]!)
          .getAllByTestId('rummy-card')
          .map((el) => el.getAttribute('data-card')),
      ).toEqual(g.cards);
    }
    expect(screen.getByText('Pure sequence ✓')).toBeInTheDocument();
    expect(screen.getByText('Set ✓')).toBeInTheDocument();
    expect(screen.getByText('Sequence (with joker) ✓')).toBeInTheDocument();
    expect(screen.getByText('Not grouped yet')).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: /^Pure sequence, complete: Four of Hearts, Five of Hearts/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('rummy-points')).toHaveAttribute(
      'data-points',
      String(best.deadwoodPoints),
    );
    expect(
      screen.getByText(`Points you would pay if someone declared now: ${best.deadwoodPoints}.`),
    ).toBeInTheDocument();
  });

  it('marks every joker (the wild 7) with a J badge and tells screen readers', () => {
    renderBoard(drawState());
    const seven = cardButton('7S');
    expect(seven.closest('[data-joker]')).not.toBeNull();
    expect(
      within(seven.closest('[data-joker]') as HTMLElement).getByTestId('rummy-joker-badge'),
    ).toHaveTextContent('★J');
    expect(seven).toHaveAccessibleDescription('joker');
    expect(cardButton('4H').closest('[data-joker]')).toBeNull();
  });

  it('sorts by suit and back again (button or G)', () => {
    renderBoard(drawState());
    fireEvent.click(screen.getByTestId('rummy-sort'));
    expect(screen.getByTestId('rummy-sort')).toHaveAttribute('data-mode', 'suit');
    expect(screen.getAllByTestId('rummy-group').map((g) => g.dataset.kind)).toEqual([
      'S',
      'H',
      'C',
      'D',
    ]);
    expect(screen.getByText('♠ Spades')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'g' });
    expect(screen.getByTestId('rummy-sort')).toHaveAttribute('data-mode', 'group');
  });

  it('shows whose turn it is', () => {
    renderBoard(drawState());
    expect(screen.getByTestId('rummy-step')).toHaveAttribute('data-step', 'draw');
    expect(screen.getByTestId('rummy-step')).toHaveTextContent('Your turn: draw a card');
  });
});

describe('IndianRummyBoard — moves', () => {
  it('draws from the stock or the open pile, and lets the learner try to take the wild joker', () => {
    const { onMove } = renderBoard(drawState());
    fireEvent.click(screen.getByTestId('rummy-stock'));
    fireEvent.click(screen.getByTestId('rummy-discard-pile'));
    fireEvent.click(screen.getByTestId('rummy-wild'));
    expect(onMove.mock.calls.map((c) => c[0])).toEqual([
      { type: 'draw', from: 'stock' },
      { type: 'draw', from: 'discard' },
      { type: 'draw', from: 'wild' },
    ]);
  });

  it('S and O draw from the keyboard anywhere on the page', () => {
    const { onMove } = renderBoard(drawState());
    fireEvent.keyDown(document.body, { key: 's' });
    fireEvent.keyDown(document.body, { key: 'O' });
    expect(onMove.mock.calls.map((c) => c[0])).toEqual([
      { type: 'draw', from: 'stock' },
      { type: 'draw', from: 'discard' },
    ]);
    // …but not while typing, with a modifier held, or on key repeat.
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 's' });
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 's', repeat: true });
    expect(onMove).toHaveBeenCalledTimes(2);
    input.remove();
  });

  it('selects a card, then Discard (button, D, or a second press on the card) throws it', () => {
    const state = completeState();
    const { onMove } = renderBoard(state);
    expect(screen.getByTestId('rummy-step')).toHaveAttribute('data-step', 'discard');
    expect(screen.getByTestId('rummy-discard')).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(cardButton('KD'));
    expect(cardButton('KD')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('rummy-discard')).toHaveAccessibleName('Discard K♦');
    expect(screen.getByTestId('rummy-discard')).toHaveTextContent('Throw K♦');
    expect(screen.getByTestId('rummy-discard')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByTestId('rummy-discard'));
    fireEvent.keyDown(document.body, { key: 'd' });
    fireEvent.click(cardButton('KD'));
    expect(onMove.mock.calls.map((c) => c[0])).toEqual([
      { type: 'discard', card: 'KD' },
      { type: 'discard', card: 'KD' },
      { type: 'discard', card: 'KD' },
    ]);
  });

  it('asks for a card first when Discard is pressed with nothing selected', () => {
    const { onMove } = renderBoard(completeState());
    fireEvent.click(screen.getByTestId('rummy-discard'));
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('rummy-note')).toHaveTextContent(
      'Select a card first: tap it (or use the arrow keys and Enter), then press Discard.',
    );
  });

  it('lets the learner try to discard before drawing (the coach explains)', () => {
    const { onMove } = renderBoard(drawState());
    fireEvent.click(screen.getByTestId('rummy-discard'));
    expect(onMove).toHaveBeenCalledWith({ type: 'discard', card: MINE[0] });
    fireEvent.click(cardButton('2S'));
    fireEvent.click(screen.getByTestId('rummy-declare'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'declare', discard: '2S' });
  });

  it('declares with the selected card, and still submits a declare that would be invalid', () => {
    const { onMove } = renderBoard(completeState());
    expect(screen.getByTestId('rummy-ready')).toHaveTextContent('Ready to declare!');
    fireEvent.click(cardButton('KD'));
    expect(screen.getByTestId('rummy-declare')).toHaveAttribute('data-legal', 'true');
    fireEvent.keyDown(document.body, { key: 'r' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'declare', discard: 'KD' });

    fireEvent.click(cardButton('4H'));
    expect(screen.getByTestId('rummy-declare')).not.toHaveAttribute('data-legal');
    expect(screen.getByTestId('rummy-declare')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByTestId('rummy-declare'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'declare', discard: '4H' });
  });

  it('Drop asks first — 20 points before the first draw — and only then drops', async () => {
    const { onMove } = renderBoard(drawState());
    expect(screen.getByTestId('rummy-drop')).toHaveTextContent('Give up: 20 pts');
    fireEvent.click(screen.getByTestId('rummy-drop'));
    const dialog = screen.getByRole('alertdialog', { name: 'Drop out of this game?' });
    expect(dialog).toHaveTextContent('this is a first drop: you pay 20 points');
    fireEvent.click(within(dialog).getByTestId('rummy-drop-cancel'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('rummy-drop'));
    fireEvent.click(screen.getByTestId('rummy-drop-confirm'));
    expect(onMove).toHaveBeenCalledWith({ type: 'drop' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('Drop is available before the first draw but never styled as the golden move', () => {
    renderBoard(drawState());
    const drop = screen.getByTestId('rummy-drop');
    expect(drop).toHaveAttribute('data-legal', 'true');
    expect(drop).not.toHaveAttribute('aria-disabled');
    expect(drop.className).not.toContain('gold-400');
    expect(drop.className).toContain('velvet');
  });

  it('throwing one of two identical cards leaves its twin unselected', () => {
    const twins = buildState({
      hands: [[...MINE, 'KD'], THEIRS],
      wildCard: WILD,
      discard: ['4D'],
      stockTop: ['KH'],
      phase: 'discard',
      hasDrawn: [true, true],
      turnsTaken: [2, 2],
      drawn: { from: 'stock', card: 'KD' },
    });
    const view = renderBoard(twins);
    expect(cardButtons('KD')).toHaveLength(2);
    fireEvent.click(cardButtons('KD')[0]!);
    expect(cardButtons('KD')[0]).toHaveAttribute('aria-pressed', 'true');
    const after = E.applyMove(twins, { type: 'discard', card: 'KD' });
    view.rerender(<IndianRummyBoard {...props(after)} />);
    expect(cardButtons('KD')).toHaveLength(1);
    expect(cardButtons('KD')[0]).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('[data-selected]')).toBeNull();
    expect(screen.getByTestId('rummy-discard')).toHaveAccessibleName('Discard');
  });

  it('a middle drop costs 40, and Drop after drawing goes straight to the coach', () => {
    const later = drawState({ hasDrawn: [true, true], turnsTaken: [3, 3] });
    const first = renderBoard(later);
    expect(screen.getByTestId('rummy-drop')).toHaveTextContent('Give up: 40 pts');
    first.unmount();

    const { onMove } = renderBoard(completeState());
    fireEvent.click(screen.getByTestId('rummy-drop'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onMove).toHaveBeenCalledWith({ type: 'drop' });
  });
});

describe('IndianRummyBoard — keyboard', () => {
  it('the hand is one tab stop: arrows move, Enter selects, Enter again discards, Escape clears', () => {
    const { onMove } = renderBoard(completeState());
    const hand = screen.getByTestId('rummy-hand');
    const tabbable = within(hand)
      .getAllByTestId('rummy-card')
      .filter((el) => el.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    const first = tabbable[0]!;
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const second = document.activeElement as HTMLElement;
    expect(second).not.toBe(first);
    expect(second).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(second, { key: 'End' });
    const last = document.activeElement as HTMLElement;
    expect(hand.contains(last)).toBe(true);
    fireEvent.keyDown(last, { key: 'Home' });
    expect(document.activeElement).toBe(first);

    // ↓ jumps to the first card of the next group.
    const groups = screen.getAllByTestId('rummy-group');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(within(groups[1]!).getAllByTestId('rummy-card')[0]);

    // Native buttons: Enter / Space fire click.
    const card = document.activeElement as HTMLElement;
    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(card, { key: 'Escape' });
    expect(card).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(card);
    fireEvent.click(card);
    expect(onMove).toHaveBeenCalledWith({ type: 'discard', card: card.getAttribute('data-card') });
  });

  it('every action has a real, focusable button; unavailable ones explain themselves', () => {
    renderBoard(drawState());
    for (const id of ['rummy-discard', 'rummy-declare', 'rummy-drop', 'rummy-sort']) {
      const el = screen.getByTestId(id);
      expect(el.tagName).toBe('BUTTON');
      expect(el).not.toHaveAttribute('disabled');
    }
    expect(screen.getByTestId('rummy-discard')).toHaveAccessibleDescription(
      /press it and the coach explains why/,
    );
    expect(screen.getByTestId('rummy-discard')).toHaveAttribute('aria-keyshortcuts', 'D');
    expect(screen.getByTestId('rummy-declare')).toHaveAttribute('aria-keyshortcuts', 'R');
  });
});

describe('IndianRummyBoard — the bot’s turn', () => {
  it('shows thinking dots on Dadi’s seat and ignores presses (but keeps focus)', () => {
    const state = drawState({ turn: 1 });
    const { onMove } = renderBoard(state);
    const seat = screen.getByTestId('rummy-seat-1');
    expect(seat).toHaveAttribute('data-thinking', 'true');
    expect(seat).toHaveAttribute('data-active', 'true');
    expect(within(seat).getByTestId('thinking-dots')).toBeInTheDocument();
    expect(screen.getByTestId('rummy-step')).toHaveTextContent('Dadi Diamond is playing');

    const stock = screen.getByTestId('rummy-stock');
    act(() => stock.focus());
    fireEvent.click(stock);
    fireEvent.keyDown(document.body, { key: 's' });
    fireEvent.click(screen.getByTestId('rummy-drop'));
    expect(onMove).not.toHaveBeenCalled();
    expect(stock).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('rummy-drop')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('rummy-drop')).toHaveAccessibleDescription(
      /Wait — Dadi Diamond is playing/,
    );
  });

  it('a bot holding 14 cards after its draw still shows only backs — its drawn card stays hidden', () => {
    const state = E.applyMove(drawState({ turn: 1 }), { type: 'draw', from: 'stock' });
    const { container } = renderBoard(state);
    expect(screen.getByTestId('rummy-opponent-hand-1')).toHaveAttribute('data-count', '14');
    expect(container.innerHTML).not.toContain(cardName('KH'));
  });
});

describe('IndianRummyBoard — coach mode', () => {
  it('legal moves glow; the coach’s pick pulses', () => {
    const state = drawState();
    const highlight = new Set(E.legalMoves(state, 0).map((m) => E.moveKey(m)));
    const view = renderBoard(state, { coachMode: true, highlight });
    const glowing = (id: string) =>
      screen.getByTestId(id).querySelector('[data-highlighted]') !== null;
    expect(glowing('rummy-stock')).toBe(true);
    expect(glowing('rummy-discard-pile')).toBe(true);
    expect(screen.getByTestId('rummy-drop')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('rummy-discard')).not.toHaveAttribute('data-highlighted');

    view.rerender(
      <IndianRummyBoard
        {...props(state, { coachMode: true, highlight, suggestedKey: 'draw:discard' })}
      />,
    );
    expect(
      screen.getByTestId('rummy-discard-pile').querySelector('[data-suggested]'),
    ).not.toBeNull();
    expect(screen.getByTestId('rummy-discard-pile')).toHaveAccessibleDescription("coach's pick");
    expect(screen.getByTestId('rummy-stock').querySelector('[data-suggested]')).toBeNull();
  });

  it('in the discard phase every card glows, and the suggested card (then Discard) pulses', () => {
    const state = completeState();
    const highlight = new Set(E.legalMoves(state, 0).map((m) => E.moveKey(m)));
    const p = props(state, { coachMode: true, highlight, suggestedKey: 'declare:KD' });
    render(<IndianRummyBoard {...p} />);
    for (const el of screen.getAllByTestId('rummy-card')) {
      expect(el).toHaveAttribute('data-highlighted', 'true');
    }
    expect(cardButton('KD')).toHaveAttribute('data-suggested', 'true');
    expect(cardButton('KD')).toHaveAccessibleDescription(/Coach’s pick/);
    expect(screen.getByTestId('rummy-declare')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('rummy-declare')).toHaveAttribute('data-highlighted', 'true');
  });

  it('nothing glows outside coach mode', () => {
    renderBoard(completeState());
    expect(document.querySelector('[data-highlighted]')).toBeNull();
  });
});

describe('IndianRummyBoard — game over', () => {
  it('reveals Dadi’s hand in groups, what she pays, and stamps the result', () => {
    const start = completeState();
    const end = E.applyMove(start, { type: 'declare', discard: 'KD' });
    const { container } = renderBoard(end, { busy: true });
    const theirs = screen.getByTestId('rummy-opponent-hand-1');
    expect(theirs).toHaveAttribute('data-revealed', 'true');
    for (const c of THEIRS) {
      expect(theirs.querySelector(`[data-card="${c}"]`)).not.toBeNull();
    }
    const r = E.result(end);
    expect(screen.getByTestId('rummy-verdict-1')).toHaveAttribute('data-verdict', 'pays');
    expect(screen.getByTestId('rummy-verdict-1')).toHaveTextContent(
      `Pays ${r.humanNetUnits} points`,
    );
    expect(screen.getByTestId('rummy-outcome')).toHaveAttribute('data-outcome', 'win');
    expect(screen.getByTestId('rummy-outcome')).toHaveTextContent(
      `You win· +${r.humanNetUnits} points`,
    );
    expect(screen.getByTestId('rummy-step')).toHaveAttribute('data-step', 'over');
    expect(theirs.querySelector('[data-face-down]')).toBeNull();
    expect(container.innerHTML).toContain(cardName('AS'));
  });

  it('drops the “New” tag on the last drawn card once the game is over', () => {
    const start = { ...completeState(), drawn: { from: 'stock' as const, card: '9H' as CardCode } };
    const first = renderBoard(start);
    expect(cardButton('9H')).toHaveAccessibleDescription(/just drawn/);
    expect(screen.getByText('New')).toBeInTheDocument();
    first.unmount();
    renderBoard(E.applyMove(start, { type: 'declare', discard: 'KD' }), { busy: true });
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(cardButton('9H')).not.toHaveAccessibleDescription(/just drawn/);
  });
});
