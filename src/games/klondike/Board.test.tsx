// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { seatPersonas } from '@/components/play/personas';
import { cardName, RANKS, SUITS, type StandardCard, type Suit } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { useSettings } from '@/store/settings';
import { KlondikeBoard, type KlondikeBoardProps } from './Board';
import { klondikeEngine as E, type KlondikeMove, type KlondikeState } from './engine';
import { KLONDIKE_BOTS } from './personas';
import { KLONDIKE_SEEDS } from './seeds';

const PERSONAS = seatPersonas(KLONDIKE_BOTS);

/* ------------------------------------------------------------- builders */

const C = (s: string): StandardCard[] =>
  s.trim() ? (s.trim().split(/\s+/) as StandardCard[]) : [];

interface Spec {
  /** [faceDown, faceUp] per column (missing columns are empty). */
  piles?: Array<[string, string]>;
  stock?: string;
  waste?: string;
  /** Cards on each foundation (Ace upwards). */
  home?: Partial<Record<Suit, number>>;
  extra?: Partial<KlondikeState>;
}

function build(spec: Spec): KlondikeState {
  const foundations: Record<Suit, StandardCard[]> = { S: [], H: [], D: [], C: [] };
  let home = 0;
  for (const suit of SUITS) {
    const n = spec.home?.[suit] ?? 0;
    foundations[suit] = RANKS.slice(0, n).map((r) => `${r}${suit}` as StandardCard);
    home += n;
  }
  const tableau = Array.from({ length: 7 }, (_, i) => {
    const p = spec.piles?.[i];
    return { faceDown: C(p?.[0] ?? ''), faceUp: C(p?.[1] ?? '') };
  });
  return {
    stock: C(spec.stock ?? ''),
    waste: C(spec.waste ?? ''),
    tableau,
    foundations,
    moveCount: 0,
    recycles: 0,
    resigned: false,
    flips: 0,
    lastFlipped: null,
    lastHome: null,
    bestHome: home,
    lastProgressAt: 0,
    last: null,
    ...spec.extra,
  };
}

/**
 * A small position with something for every interaction:
 *   column 1: [2 hidden] 8♠ 7♥     column 2: [1 hidden] 9♦     column 3: empty
 *   column 4: [hidden] K♣          column 5: A♥                column 6–7: [hidden] 6♣ / 3♠
 *   waste: 5♦ under the 6♦ (top) · stock: 3 cards · ♠ foundation: A♠ 2♠
 */
const HIDDEN = ['QD', 'JH', '4C', 'TC', '9S', '7C', '5H', '2H', '8D'] as const;
const STOCK = ['JC', 'QS', 'KH'] as const;

function sample(extra: Partial<KlondikeState> = {}): KlondikeState {
  return build({
    piles: [
      ['QD JH', '8S 7H'],
      ['4C', '9D'],
      ['', ''],
      ['TC', 'KC'],
      ['', 'AH'],
      ['9S 7C', '6C'],
      ['5H 2H 8D', '3S'],
    ],
    stock: STOCK.join(' '),
    waste: '5D 6D',
    home: { S: 2 },
    extra,
  });
}

type Source = Extract<KlondikeMove, { type: 'move' }>['from'];
type Target = Extract<KlondikeMove, { type: 'move' }>['to'];
const mvFrom = (from: Source, to: Target): KlondikeMove => ({ type: 'move', from, to });
const colMove = (pile: number, index: number, to: number): KlondikeMove =>
  mvFrom({ kind: 'tableau', pile, index }, { kind: 'tableau', pile: to });
const home = (from: Source) => mvFrom(from, { kind: 'foundation' });

function props(state: KlondikeState, extra: Partial<KlondikeBoardProps> = {}) {
  const over = E.isOver(state);
  return {
    state,
    human: 0,
    legalMoves: over ? [] : E.legalMoves(state, 0),
    onMove: vi.fn(),
    busy: over,
    thinking: null,
    coachMode: false,
    highlight: new Set<string>(),
    suggestedKey: null,
    personas: PERSONAS,
    over,
    ...extra,
  } satisfies KlondikeBoardProps;
}

function renderBoard(state: KlondikeState, extra: Partial<KlondikeBoardProps> = {}) {
  const onMove = vi.fn<(move: KlondikeMove) => void>();
  const p = props(state, { onMove, ...extra });
  const view = render(<KlondikeBoard {...p} />);
  return { ...view, onMove, props: p };
}

/** The Board driven by the real engine (illegal moves are recorded but not applied). */
function Live({ initial, onMove }: { initial: KlondikeState; onMove: (m: KlondikeMove) => void }) {
  const [state, setState] = useState(initial);
  const over = E.isOver(state);
  return (
    <KlondikeBoard
      {...props(state)}
      busy={over}
      onMove={(m) => {
        onMove(m);
        if (E.checkMove(state, 0, m).ok) setState(E.applyMove(state, m));
      }}
    />
  );
}

const col = (i: number) => screen.getByTestId(`klondike-col-${i}`);
const card = (code: string) => screen.getByTestId(`klondike-card-${code}`);
const key = (k: string, el: Element = document.activeElement ?? document.body) =>
  fireEvent.keyDown(el, { key: k });

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  useSettings.setState({ motion: 'reduce' });
});

afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ table */

describe('KlondikeBoard — the table', () => {
  it('lays out the stock, waste, four foundations and seven columns with their test ids', () => {
    renderBoard(sample());
    for (const id of [
      'klondike-stock',
      'klondike-waste',
      'klondike-resign',
      'klondike-autofinish',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    for (const suit of SUITS) {
      expect(screen.getByTestId(`klondike-foundation-${suit}`)).toBeInTheDocument();
    }
    for (let i = 0; i < 7; i++) expect(col(i)).toBeInTheDocument();
  });

  it('labels every zone for screen readers from what the learner can see', () => {
    renderBoard(sample());
    expect(screen.getByRole('button', { name: 'Stock — press to draw a card, 3 cards' })).toBe(
      screen.getByTestId('klondike-stock'),
    );
    expect(screen.getByTestId('klondike-waste')).toHaveAccessibleName(
      'Waste: Six of Diamonds on top, 2 cards',
    );
    expect(screen.getByTestId('klondike-foundation-S')).toHaveAccessibleName(
      'Spades foundation: 2 cards, top card Two of Spades',
    );
    expect(screen.getByTestId('klondike-foundation-H')).toHaveAccessibleName(
      'Hearts foundation: empty — it starts with the Ace of Hearts',
    );
    expect(col(0)).toHaveAccessibleName(
      'Column 1: 2 face-down cards, then Eight of Spades and Seven of Hearts',
    );
    expect(col(2)).toHaveAccessibleName('Column 3: empty — only a King can go here');
    expect(col(4)).toHaveAccessibleName('Column 5: Ace of Hearts');
  });

  it('never puts a face-down card or a stock card in the DOM', () => {
    const { container } = renderBoard(sample());
    const html = container.innerHTML;
    for (const code of [...HIDDEN, ...STOCK]) {
      expect(html).not.toContain(cardName(code));
      expect(html).not.toContain(`klondike-card-${code}`);
      expect(container.querySelector(`[data-card="${code}"]`)).toBeNull();
    }
    // Only the face-up cards have faces on the table; column 7 shows one face over 3 backs.
    expect(col(6).querySelectorAll('[data-card]')).toHaveLength(1);
    expect(col(6).querySelectorAll('[data-testid^="klondike-facedown-"]')).toHaveLength(3);
    const faces = [...container.querySelectorAll('[data-card]')].map((el) =>
      el.getAttribute('data-card'),
    );
    expect(faces.sort()).toEqual(
      ['2S', '3S', '5D', '6C', '6D', '7H', '8S', '9D', 'AH', 'AS', 'KC'].sort(),
    );
  });

  it('keeps a real dealt game’s hidden cards out of the DOM too', () => {
    const s = E.setup({ players: 1 }, createRng(KLONDIKE_SEEDS.practice));
    const { container } = renderBoard(s);
    const hidden = [...s.stock, ...s.tableau.flatMap((p) => p.faceDown)];
    expect(hidden).toHaveLength(45);
    for (const code of hidden) {
      // (Aces are named by the empty foundations' labels: "it starts with the Ace of …".)
      if (!code.startsWith('A')) expect(container.innerHTML).not.toContain(cardName(code));
      expect(container.querySelector(`[data-testid="klondike-card-${code}"]`)).toBeNull();
      expect(container.querySelector(`[data-card="${code}"]`)).toBeNull();
    }
    for (const p of s.tableau) expect(card(p.faceUp[0]!)).toBeInTheDocument();
  });

  it('turns the face-down column cards up (dimmed) once the game is over', () => {
    const s = sample({ resigned: true });
    const { container } = renderBoard(s);
    expect(screen.getByTestId('klondike-board')).toHaveAttribute('data-over', 'true');
    expect(container.querySelector('[data-card="QD"]')).toHaveAttribute('data-dimmed', 'true');
    expect(col(0)).toHaveAccessibleName(
      'Column 1: Queen of Diamonds, Jack of Hearts, Eight of Spades and Seven of Hearts',
    );
    // The stock stays face down.
    expect(container.innerHTML).not.toContain(cardName('KH'));
  });

  it('shows the Vegas readout: cards home, stake back and the break-even mark', () => {
    renderBoard(build({ home: { S: 5, H: 4, D: 3 }, stock: 'KD' }));
    const readout = screen.getByTestId('klondike-readout');
    expect(readout).toHaveAttribute('data-home', '12');
    expect(readout).toHaveAttribute('data-ahead', 'true');
    expect(readout).toHaveTextContent('12 / 52');
    expect(readout).toHaveTextContent('×1.15');
    expect(
      within(readout).getByText(
        'Cards home: 12 of 52. Stake back: 1.15 times your stake. You are ahead.',
      ),
    ).toHaveClass('sr-only');
  });
});

/* -------------------------------------------------------------- pointer */

describe('KlondikeBoard — tap to pick up, tap to put down', () => {
  it('draws from the stock (and turns the waste over once the stock is empty)', () => {
    const { onMove, unmount } = renderBoard(sample());
    fireEvent.click(screen.getByTestId('klondike-stock'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'draw' });
    fireEvent.click(screen.getByTestId('klondike-draw'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'draw' });
    unmount();

    const empty = renderBoard(build({ waste: '4D 5D', piles: [['', 'KS']] }));
    expect(screen.getByTestId('klondike-draw')).toHaveTextContent('Turn over');
    fireEvent.click(screen.getByTestId('klondike-stock'));
    expect(empty.onMove).toHaveBeenLastCalledWith({ type: 'recycle' });
  });

  it('moves a card: tap it, then tap the column it should go on', () => {
    const { onMove } = renderBoard(sample());
    fireEvent.click(card('6C'));
    expect(col(5)).toHaveAttribute('data-selected', 'true');
    expect(col(5)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(card('7H'));
    expect(onMove).toHaveBeenCalledWith(colMove(5, 0, 0));
  });

  it('picks up a run by tapping the deeper card, and puts it back with a second tap', () => {
    const { onMove } = renderBoard(sample());
    fireEvent.click(card('8S'));
    expect(screen.getByTestId('klondike-note')).toHaveTextContent(
      'Eight of Spades down to Seven of Hearts, 2 cards',
    );
    fireEvent.click(card('9D'));
    expect(onMove).toHaveBeenCalledWith(colMove(0, 0, 1));

    onMove.mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
    fireEvent.click(card('7H'));
    vi.advanceTimersByTime(2000); // a slow second tap is not a double-tap
    fireEvent.click(card('7H'));
    expect(col(0)).not.toHaveAttribute('data-selected');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('lets the learner attempt an illegal move (the controller explains it)', () => {
    const { onMove } = renderBoard(sample());
    fireEvent.click(card('6D'));
    fireEvent.click(col(2)); // a Six into an empty column
    expect(onMove).toHaveBeenCalledWith(mvFrom({ kind: 'waste' }, { kind: 'tableau', pile: 2 }));
  });

  it('sends cards to the foundations: waste → foundation, and foundation back down', () => {
    const { onMove } = renderBoard(sample());
    fireEvent.click(card('AH'));
    fireEvent.click(screen.getByTestId('klondike-foundation-H'));
    expect(onMove).toHaveBeenLastCalledWith(home({ kind: 'tableau', pile: 4, index: 0 }));

    fireEvent.click(screen.getByTestId('klondike-foundation-S'));
    fireEvent.click(col(6));
    expect(onMove).toHaveBeenLastCalledWith(
      mvFrom({ kind: 'foundation', suit: 'S' }, { kind: 'tableau', pile: 6 }),
    );
  });

  it('double-tapping a card sends it home', () => {
    const { onMove } = renderBoard(sample());
    vi.useFakeTimers({ toFake: ['Date'] });
    fireEvent.click(card('AH'));
    vi.advanceTimersByTime(150);
    fireEvent.click(card('AH'));
    expect(onMove).toHaveBeenCalledWith(home({ kind: 'tableau', pile: 4, index: 0 }));
    onMove.mockClear();
    vi.advanceTimersByTime(2000);
    fireEvent.click(card('6D'));
    vi.advanceTimersByTime(150);
    fireEvent.click(card('6D'));
    expect(onMove).toHaveBeenCalledWith(home({ kind: 'waste' }));
    // A quick double-tap must not zoom the page on phones.
    for (const id of ['klondike-waste', 'klondike-col-4', 'klondike-foundation-S']) {
      expect(screen.getByTestId(id)).toHaveClass('touch-manipulation');
    }
  });

  it('tapping a face-down card asks the engine, which explains why it cannot move', () => {
    const { onMove } = renderBoard(sample());
    fireEvent.click(screen.getByTestId('klondike-facedown-1-0'));
    expect(onMove).toHaveBeenCalledWith(home({ kind: 'tableau', pile: 1, index: -1 }));
  });

  it('marks every column and foundation as a drop target for drag and drop', () => {
    renderBoard(sample());
    for (let i = 0; i < 7; i++) expect(col(i)).toHaveAttribute('data-drop-id', `col-${i}`);
    expect(screen.getByTestId('klondike-foundation-D')).toHaveAttribute('data-drop-id', 'f-D');
    expect(screen.getByTestId('klondike-stock')).not.toHaveAttribute('data-drop-id');
  });

  it('ignores presses while busy, but the piles keep focus', () => {
    const { onMove } = renderBoard(sample(), { busy: true });
    const stock = screen.getByTestId('klondike-stock');
    stock.focus();
    fireEvent.click(stock);
    fireEvent.click(card('9D'));
    fireEvent.click(screen.getByTestId('klondike-draw'));
    expect(onMove).not.toHaveBeenCalled();
    expect(stock).toHaveFocus();
    expect(stock).toHaveAttribute('aria-disabled', 'true');
  });
});

/* ------------------------------------------------------------- keyboard */

describe('KlondikeBoard — full keyboard play', () => {
  it('every pile is a Tab stop in order: stock, waste, foundations, columns 1–7', () => {
    renderBoard(sample());
    const order = [...screen.getByTestId('klondike-board').querySelectorAll('[data-pile]')].map(
      (el) => el.getAttribute('data-pile'),
    );
    expect(order).toEqual([
      'stock',
      'waste',
      'f-S',
      'f-H',
      'f-D',
      'f-C',
      'col-0',
      'col-1',
      'col-2',
      'col-3',
      'col-4',
      'col-5',
      'col-6',
    ]);
    for (const el of screen.getByTestId('klondike-board').querySelectorAll('[data-pile]')) {
      expect(el.tagName).toBe('BUTTON');
      expect(el).not.toHaveAttribute('tabindex', '-1');
    }
  });

  it('arrows walk the piles; ↑/↓ hop between the top row and the columns', () => {
    renderBoard(sample());
    screen.getByTestId('klondike-stock').focus();
    key('ArrowRight');
    expect(screen.getByTestId('klondike-waste')).toHaveFocus();
    key('ArrowRight');
    expect(screen.getByTestId('klondike-foundation-S')).toHaveFocus();
    key('ArrowDown');
    expect(col(3)).toHaveFocus();
    key('ArrowLeft');
    expect(col(2)).toHaveFocus();
    key('ArrowUp');
    expect(screen.getByTestId('klondike-waste')).toHaveFocus();
    key('End');
    expect(col(6)).toHaveFocus();
    key('Home');
    expect(screen.getByTestId('klondike-stock')).toHaveFocus();
  });

  it('announces the full instructions on pick-up, then just the run as ↑/↓ change it', () => {
    render(<LiveAnnouncer />);
    renderBoard(sample());
    act(() => col(0).focus());
    fireEvent.click(col(0));
    const live = () => document.querySelector('[aria-live="polite"]')?.textContent ?? '';
    expect(live()).toMatch(/^Picked up Seven of Hearts from column 1\. Up and Down arrows/);
    key('ArrowUp');
    expect(live()).toMatch(/^Holding Eight of Spades down to Seven of Hearts, 2 cards\.\u200b?$/);
  });

  it('Enter picks up the top card, ↑ takes a deeper run, Enter on a column puts it there', () => {
    const { onMove } = renderBoard(sample());
    col(0).focus();
    fireEvent.click(col(0)); // Enter/Space on a <button> fires click
    expect(screen.getByTestId('klondike-note')).toHaveTextContent('Seven of Hearts');
    key('ArrowUp');
    expect(screen.getByTestId('klondike-note')).toHaveTextContent(
      'Eight of Spades down to Seven of Hearts',
    );
    key('ArrowDown');
    key('ArrowUp');
    key('ArrowRight');
    expect(col(1)).toHaveFocus();
    fireEvent.click(col(1));
    expect(onMove).toHaveBeenCalledWith(colMove(0, 0, 1));
  });

  it('Escape puts the picked-up card back', () => {
    const { onMove } = renderBoard(sample());
    col(1).focus();
    fireEvent.click(col(1));
    expect(col(1)).toHaveAttribute('data-selected', 'true');
    key('Escape');
    expect(col(1)).not.toHaveAttribute('data-selected');
    fireEvent.click(col(3));
    // Nothing was picked up any more, so this just picks up the King.
    expect(onMove).not.toHaveBeenCalled();
    expect(col(3)).toHaveAttribute('data-selected', 'true');
  });

  it('A sends the focused pile’s top card home; D draws from anywhere', () => {
    const { onMove } = renderBoard(sample());
    screen.getByTestId('klondike-waste').focus();
    key('a');
    expect(onMove).toHaveBeenLastCalledWith(home({ kind: 'waste' }));
    col(4).focus();
    key('A');
    expect(onMove).toHaveBeenLastCalledWith(home({ kind: 'tableau', pile: 4, index: 0 }));
    key('d', document.body);
    expect(onMove).toHaveBeenLastCalledWith({ type: 'draw' });
    expect(screen.getByTestId('klondike-draw')).toHaveAttribute('aria-keyshortcuts', 'D');
    expect(screen.getByTestId('klondike-home')).toHaveAttribute('aria-keyshortcuts', 'A');
  });

  it('"Send home" uses the picked-up card, or explains what to do first', () => {
    const { onMove } = renderBoard(sample());
    fireEvent.click(screen.getByTestId('klondike-home'));
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('klondike-note')).toHaveTextContent('Pick a card');
    fireEvent.click(card('AH'));
    fireEvent.click(screen.getByTestId('klondike-home'));
    expect(onMove).toHaveBeenCalledWith(home({ kind: 'tableau', pile: 4, index: 0 }));
  });

  it('plays a real move sequence from the keyboard with the live engine', () => {
    const moves: KlondikeMove[] = [];
    render(<Live initial={sample()} onMove={(m) => moves.push(m)} />);
    // 9♦ (column 2) onto nothing useful… instead: A♥ home with A, then 9♦'s column flips.
    col(4).focus();
    key('a');
    expect(screen.getByTestId('klondike-foundation-H')).toHaveAccessibleName(
      'Hearts foundation: 1 card, top card Ace of Hearts',
    );
    expect(col(4)).toHaveAccessibleName('Column 5: empty — only a King can go here');
    // K♣ into the empty column 5 — the hidden Ten of Clubs in column 4 turns over.
    col(3).focus();
    fireEvent.click(col(3));
    key('ArrowRight');
    fireEvent.click(col(4));
    expect(moves.at(-1)).toEqual(colMove(3, 0, 4));
    expect(col(3)).toHaveAccessibleName('Column 4: Ten of Clubs');
    expect(card('TC')).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------- coach */

describe('KlondikeBoard — coach mode', () => {
  it('glows legal moves only in coach mode', () => {
    const s = sample();
    const all = new Set(E.legalMoves(s, 0).map(E.moveKey));
    const { unmount } = renderBoard(s, { coachMode: true, highlight: all });
    expect(screen.getByTestId('klondike-stock')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('klondike-draw')).toHaveAttribute('data-highlighted', 'true');
    // A♥ can go home and the 8♠ run can go onto the 9♦ … the 9♦ has nowhere to go.
    expect(card('AH').querySelector('[data-highlighted]')).not.toBeNull();
    expect(card('8S').querySelector('[data-card="8S"]')).toHaveAttribute(
      'data-highlighted',
      'true',
    );
    expect(card('9D').querySelector('[data-card="9D"]')).not.toHaveAttribute('data-highlighted');
    unmount();

    renderBoard(s, { coachMode: false, highlight: new Set() });
    expect(screen.getByTestId('klondike-stock')).not.toHaveAttribute('data-highlighted');
    expect(document.querySelectorAll('[data-highlighted]')).toHaveLength(0);
  });

  it('after picking a card up, glows the places it may go', () => {
    const s = sample();
    const all = new Set(E.legalMoves(s, 0).map(E.moveKey));
    renderBoard(s, { coachMode: true, highlight: all });
    fireEvent.click(card('KC'));
    expect(col(2)).toHaveAttribute('data-highlighted', 'true');
    expect(col(4)).not.toHaveAttribute('data-highlighted');
    expect(col(2)).toHaveAccessibleDescription(/move the selected cards here/);
  });

  it('pulses the coach’s pick: the card to move and where it goes', () => {
    const s = sample();
    const all = new Set(E.legalMoves(s, 0).map(E.moveKey));
    const pick = E.moveKey(colMove(0, 0, 1));
    renderBoard(s, { coachMode: true, highlight: all, suggestedKey: pick });
    expect(card('8S').querySelector('[data-card="8S"]')).toHaveAttribute('data-suggested', 'true');
    expect(card('7H').querySelector('[data-card="7H"]')).toHaveAttribute('data-suggested', 'true');
    expect(col(1)).toHaveAttribute('data-suggested', 'true');
    expect(col(1)).toHaveAccessibleDescription(/The coach’s pick: move here/);
    expect(col(0)).toHaveAccessibleDescription(/The coach’s pick: move from here/);
    expect(screen.getByTestId('klondike-draw')).not.toHaveAttribute('data-suggested');
  });

  it('pulses Draw and the stock when drawing is the pick, and "I’m done" when stopping is', () => {
    const s = sample();
    const { unmount } = renderBoard(s, { coachMode: true, suggestedKey: 'draw' });
    expect(screen.getByTestId('klondike-stock')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('klondike-draw')).toHaveAttribute('data-suggested', 'true');
    unmount();
    renderBoard(s, { coachMode: true, suggestedKey: 'resign' });
    expect(screen.getByTestId('klondike-resign')).toHaveAttribute('data-suggested', 'true');
  });

  it('tells screen readers the stock is where you draw (or turn the waste over)', () => {
    const s = sample();
    const { unmount } = renderBoard(s, { coachMode: true, highlight: new Set(['draw']) });
    expect(screen.getByTestId('klondike-stock')).toHaveAccessibleDescription(
      'You can draw a card here.',
    );
    unmount();
    renderBoard(sample({ stock: [] }), { coachMode: true, highlight: new Set(['recycle']) });
    expect(screen.getByTestId('klondike-stock')).toHaveAccessibleDescription(
      'You can turn the waste over here.',
    );
  });

  it('pulses the right suit’s foundation for a suggested move home', () => {
    const s = sample();
    renderBoard(s, {
      coachMode: true,
      suggestedKey: E.moveKey(home({ kind: 'tableau', pile: 4, index: 0 })),
    });
    expect(screen.getByTestId('klondike-foundation-H')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('klondike-foundation-S')).not.toHaveAttribute('data-suggested');
  });
});

/* -------------------------------------------------------------- actions */

describe('KlondikeBoard — I’m done and Auto-finish', () => {
  it('"I’m done" asks first, then resigns; "Keep playing" changes nothing', () => {
    const { onMove } = renderBoard(sample());
    fireEvent.click(screen.getByTestId('klondike-resign'));
    const dialog = screen.getByRole('dialog', { name: 'Stop this game?' });
    expect(dialog).toHaveTextContent('2 cards on the foundations, which pays back 0.19 times');
    fireEvent.click(within(dialog).getByTestId('klondike-resign-cancel'));
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('klondike-resign'));
    fireEvent.click(screen.getByTestId('klondike-resign-confirm'));
    expect(onMove).toHaveBeenCalledWith({ type: 'resign' });
  });

  it('"I’m done" is always a real option: never announced as unavailable, but never glows', () => {
    renderBoard(sample(), { coachMode: true, highlight: new Set(['resign']) });
    const resign = screen.getByTestId('klondike-resign');
    // aria-disabled would tell screen readers (and Playwright) the button cannot be used.
    expect(resign).not.toHaveAttribute('aria-disabled');
    expect(resign).not.toHaveAccessibleDescription(/Not available/);
    expect(resign).not.toHaveAttribute('data-highlighted');
    expect(resign).not.toHaveAttribute('data-suggested');
    expect(resign.className).not.toMatch(/text-ink/);
  });

  it('"Send home" sends the top card of the pile that last had focus', () => {
    const { onMove } = renderBoard(sample());
    act(() => col(4).focus());
    fireEvent.click(screen.getByTestId('klondike-home'));
    expect(onMove).toHaveBeenCalledWith(home({ kind: 'tableau', pile: 4, index: 0 }));
  });

  it('Auto-finish sends the cards home one move at a time until the board is clear', async () => {
    vi.useFakeTimers();
    // Everything is face up and the stock is used up: the game is won.
    const s = build({
      home: { S: 12, H: 12, D: 11, C: 12 },
      piles: [
        ['', 'KS'],
        ['', 'KH QD'],
        ['', 'KC'],
        ['', 'KD'],
      ],
    });
    const moves: KlondikeMove[] = [];
    render(<Live initial={s} onMove={(m) => moves.push(m)} />);
    expect(screen.getByTestId('klondike-autofinish')).toHaveTextContent('Finish the game');
    fireEvent.click(screen.getByTestId('klondike-autofinish'));
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }
    expect(moves).toHaveLength(5);
    expect(moves.every((m) => m.type === 'move' && m.to.kind === 'foundation')).toBe(true);
    expect(screen.getByTestId('klondike-readout')).toHaveAttribute('data-home', '52');
  });

  it('Auto-finish says so when no card can safely go home', () => {
    const { onMove } = renderBoard(
      build({
        piles: [
          ['4C', '9D'],
          ['', 'KS'],
        ],
        stock: 'QH',
      }),
    );
    expect(screen.getByTestId('klondike-autofinish')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByTestId('klondike-autofinish'));
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('klondike-note')).toHaveTextContent(
      'No card can safely go home right now.',
    );
  });
});
