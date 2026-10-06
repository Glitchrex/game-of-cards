// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { seatPersonas } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { useSettings } from '@/store/settings';
import { AUTO_BATTLES, AUTO_REDUCED_MS, WarBoard, type WarBoardProps } from './Board';
import { revealMs } from './board/view';
import { warEngine as E, type WarMove, type WarState } from './engine';
import { BUGLE_BHASKAR } from './personas';
import { deal52, flip, stateWith } from './test-helpers';

const PERSONAS = seatPersonas([BUGLE_BHASKAR]);

function props(state: WarState, extra: Partial<WarBoardProps> = {}) {
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
  } satisfies WarBoardProps;
}

function renderBoard(state: WarState, extra: Partial<WarBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<WarBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

/** Every card code / name that must never appear in the page. */
function secretsOf(codes: readonly CardCode[]): string[] {
  return codes.flatMap((c) => [`"${c}"`, cardName(c)]);
}

const faces = (root: HTMLElement) =>
  [...root.querySelectorAll('[data-card]')].map((el) => el.getAttribute('data-card'));

/** 7♥ vs 7♣ ties; 3 face down each; A♥ beats J♣. Seat 0 then holds 2♠…, seat 1 holds 9♠…. */
const warPosition = () =>
  deal52(['7H', '2C', '3C', '4C', 'AH', '2S'], ['7C', '5D', '6D', '8D', 'JC', '9S']);
const WAR_DOWN: CardCode[] = ['2C', '3C', '4C', '5D', '6D', '8D'];

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  // Battles land instantly; the reveal has its own tests below.
  useSettings.setState({ motion: 'reduce' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WarBoard — the table', () => {
  it('seats the opponent and the learner with face-down piles, and waits for battle 1', () => {
    const state = deal52(['KS'], ['4D']);
    const { container } = renderBoard(state);

    const seat = screen.getByTestId('war-bot-seat');
    expect(within(seat).getByText('Bugle Bhaskar')).toBeInTheDocument();
    expect(within(seat).getByText(BUGLE_BHASKAR.tagline)).toBeInTheDocument();
    expect(screen.getByTestId('war-you-seat')).toHaveAttribute('data-active', 'true');
    expect(within(screen.getByTestId('war-you-seat')).getByText('Your turn')).toBeInTheDocument();

    expect(screen.getByRole('img', { name: 'Your pile, 26 cards' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Bugle Bhaskar’s pile, 26 cards' })).toBeInTheDocument();
    expect(screen.getByTestId('war-pile-0')).toHaveAttribute('data-count', '26');
    expect(screen.getByTestId('war-pile-1')).toHaveAttribute('data-count', '26');

    expect(screen.getByTestId('war-ready')).toHaveTextContent('Ready for battle');
    expect(screen.getByTestId('war-battle')).toHaveAttribute('data-number', '0');
    expect(screen.getByTestId('war-counter')).toHaveTextContent('No battles yet: 60 to play');
    expect(screen.getByTestId('war-count-bar')).toHaveAttribute('data-leader', 'level');
    expect(
      screen.getByRole('img', {
        name: 'Who holds more cards: You have 26 cards and Bugle Bhaskar has 26.',
      }),
    ).toBeInTheDocument();

    // Both piles are face down: no card face anywhere, not even the top cards' names.
    expect(faces(container)).toEqual([]);
    for (const secret of secretsOf([...state.piles[0], ...state.piles[1]])) {
      expect(container.innerHTML).not.toContain(secret);
    }
  });

  it('lays out the ready table like a battle, so the first Flip does not move the Flip button', () => {
    const state = deal52(['KS'], ['4D']);
    const p = props(state);
    const { rerender } = render(<WarBoard {...p} />);
    const ready = screen.getByTestId('war-ready');
    // The empty lanes are already named, like a battle's lanes.
    expect(ready).toHaveTextContent('You');
    expect(ready).toHaveTextContent('Bugle Bhaskar');
    const skeleton = (view: HTMLElement) => ({
      view: view.className,
      // Same rows (header, lanes, outcome slot); only the header's alignment differs.
      rows: [...view.children].map((row) =>
        row.className
          .split(' ')
          .filter((c) => !c.startsWith('justify-'))
          .sort()
          .join(' '),
      ),
      rowHeights: [...view.querySelectorAll<HTMLElement>('[style*="min-height"]')].map(
        (el) => el.style.minHeight,
      ),
    });
    const before = skeleton(ready);

    const next = flip(state);
    rerender(<WarBoard {...props(next)} onMove={p.onMove} />);
    const after = skeleton(screen.getByTestId('war-battle-view'));
    expect(after.view).toBe(before.view);
    expect(after.rows).toEqual(before.rows);
    expect(after.rowHeights).toEqual(before.rowHeights);
    expect(before.rowHeights).toHaveLength(2);
  });

  it('shows a plain battle side by side: higher card wins both', () => {
    const state = flip(deal52(['KS', '2H'], ['4D', '9C']));
    const { container } = renderBoard(state);

    expect(screen.getByTestId('war-battle')).toHaveAttribute('data-number', '1');
    expect(
      screen.getByRole('group', { name: 'Your cards in this battle: King of Spades' }),
    ).toHaveAttribute('data-won', 'true');
    expect(
      screen.getByRole('group', { name: 'Bugle Bhaskar’s cards in this battle: Four of Diamonds' }),
    ).not.toHaveAttribute('data-won');
    expect(faces(container).sort()).toEqual(['4D', 'KS']);
    const outcome = screen.getByTestId('war-outcome');
    expect(outcome).toHaveAttribute('data-winner', '0');
    expect(outcome).toHaveAttribute('data-decided-by', 'higher-card');
    expect(outcome).toHaveTextContent('Higher card wins!You take both cards.');
    expect(screen.queryByTestId('war-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('war-deciding')).toBeInTheDocument();

    expect(screen.getByTestId('war-pile-0')).toHaveAttribute('data-count', '27');
    expect(screen.getByTestId('war-pile-1')).toHaveAttribute('data-count', '25');
    expect(screen.getByTestId('war-gain-0')).toHaveTextContent('2 cards won');
    expect(screen.queryByTestId('war-gain-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('war-counter')).toHaveTextContent('Battle 1 of 60');
    expect(screen.getByTestId('war-scoreboard')).toHaveTextContent('59 left');
    expect(screen.getByTestId('war-count-bar')).toHaveAttribute('data-leader', 'you');
    // The next cards in both piles stay hidden.
    expect(container.innerHTML).not.toMatch(/Two of Hearts|Nine of Clubs|"2H"|"9C"/);
  });

  it('shows a war: the banner, 3 face-down cards a side that never reach the DOM, and the winner', () => {
    const state = flip(warPosition());
    const { container } = renderBoard(state);

    expect(screen.getByTestId('war-banner')).toHaveTextContent('War!');
    expect(screen.getByTestId('war-banner')).toHaveAttribute('data-wars', '1');
    const mine = screen.getByRole('group', {
      name: 'Your cards in this battle: Seven of Hearts, 3 face-down cards and Ace of Hearts',
    });
    const theirs = screen.getByRole('group', {
      name: 'Bugle Bhaskar’s cards in this battle: Seven of Clubs, 3 face-down cards and Jack of Clubs',
    });
    expect(mine.querySelectorAll('[data-war-down]')).toHaveLength(3);
    expect(theirs.querySelectorAll('[data-war-down]')).toHaveLength(3);
    expect(faces(container).sort()).toEqual(['7C', '7H', 'AH', 'JC']);
    for (const secret of secretsOf([...WAR_DOWN, '2S', '9S'])) {
      expect(container.innerHTML).not.toContain(secret);
    }
    expect(screen.getByTestId('war-outcome')).toHaveTextContent(
      'You win the war!You take all 10 cards.',
    );
    expect(screen.getByTestId('war-pile-0')).toHaveAttribute('data-count', '31');
    expect(screen.getByTestId('war-gain-0')).toHaveTextContent('+10');
  });

  it('keeps face-down war cards hidden even after the game is over', () => {
    // The opponent holds just 5 cards: losing the war ends the game.
    const state = flip(deal52(['7H', '2C', '3C', '4C', 'AH'], ['7C', '5D', '6D', '8D', 'JC'], 47));
    expect(E.isOver(state)).toBe(true);
    const { container } = renderBoard(state);
    for (const secret of secretsOf(WAR_DOWN)) expect(container.innerHTML).not.toContain(secret);
    expect(screen.getByTestId('war-board')).toHaveAttribute('data-phase', 'over');
    expect(screen.getByTestId('war-pile-1')).toHaveAttribute('data-count', '0');
    expect(screen.getByRole('img', { name: 'Bugle Bhaskar’s pile, empty' })).toBeInTheDocument();
    expect(screen.getByTestId('war-scoreboard')).toHaveTextContent('Game over after 1 battle');
  });

  it('names a double war and an opponent win', () => {
    const state = flip(
      deal52(
        ['7H', '2C', '3C', '4C', 'QH', '2D', '3D', '4D', '5H'],
        ['7C', '5D', '6D', '8D', 'QS', '6H', '8H', '9H', 'KH'],
      ),
    );
    renderBoard(state);
    expect(screen.getByTestId('war-banner')).toHaveTextContent('Double war!');
    expect(screen.getByTestId('war-outcome')).toHaveAttribute('data-winner', '1');
    expect(screen.getByTestId('war-outcome')).toHaveTextContent(
      'Bugle Bhaskar wins the war!Bugle Bhaskar takes all 18 cards.',
    );
    expect(screen.getByTestId('war-lane-1')).toHaveAttribute('data-won', 'true');
    expect(screen.getByTestId('war-gain-1')).toHaveTextContent('+18');
    expect(screen.getByTestId('war-count-bar')).toHaveAttribute('data-leader', 'bot');
  });

  it('shows a short-handed war and running out of cards', () => {
    // The learner ties with their last card: no card is left to fight the war.
    const state = flip(stateWith([['7H'], ['7C', '2D', '3D', '4D', '5D']]));
    const { container } = renderBoard(state);
    expect(screen.getByTestId('war-outcome')).toHaveAttribute('data-decided-by', 'out-of-cards');
    expect(screen.getByTestId('war-outcome')).toHaveTextContent(
      'You ran out of cards!Bugle Bhaskar takes both cards.',
    );
    expect(screen.getByTestId('war-banner')).toHaveTextContent('War!');
    expect(container.innerHTML).not.toMatch(/Two of Diamonds|"2D"/);

    // Two cards left: one goes face down and the last one is turned up.
    const short = flip(
      stateWith([
        ['9H', '2C', 'KC'],
        ['9C', '3D', '4D', '5D', '6D', '8S'],
      ]),
    );
    renderBoard(short);
    expect(
      screen.getByRole('group', {
        name: 'Your cards in this battle: Nine of Hearts, 1 face-down card and King of Clubs',
      }),
    ).toBeInTheDocument();
  });

  it('shows thinking dots on the opponent’s seat when the controller says so', () => {
    renderBoard(deal52(['KS'], ['4D']), { thinking: 1, busy: true });
    expect(screen.getByTestId('war-bot-seat')).toHaveAttribute('data-thinking', 'true');
    expect(screen.getByTestId('war-you-seat')).not.toHaveAttribute('data-active');
  });
});

describe('WarBoard — flipping', () => {
  it('has one big Flip button that calls onMove', () => {
    const { onMove } = renderBoard(deal52(['KS'], ['4D']));
    const group = screen.getByRole('group', { name: 'Your moves' });
    const button = within(group).getByTestId('war-flip');
    expect(button).toHaveAccessibleName('Flip');
    expect(button).toHaveAttribute('data-legal', 'true');
    expect(button).not.toHaveAttribute('aria-disabled');
    fireEvent.click(button);
    expect(onMove).toHaveBeenCalledWith({ type: 'flip' } satisfies WarMove);
  });

  it('flips with F anywhere, and with Space or Enter from the table', () => {
    const { onMove } = renderBoard(deal52(['KS'], ['4D']));
    fireEvent.keyDown(document.body, { key: 'f' });
    fireEvent.keyDown(document.body, { key: 'F' });
    fireEvent.keyDown(document.body, { key: ' ' });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('war-board'), { key: 'Enter' });
    expect(onMove).toHaveBeenCalledTimes(5);
    expect(screen.getByTestId('war-flip')).toHaveAttribute('aria-keyshortcuts', 'F Space Enter');
    expect(screen.getByTestId('war-keys')).toHaveTextContent(
      'Keyboard shortcuts:FSpaceFlipAAuto-flip',
    );
  });

  it('leaves Space and Enter to a focused control, and skips typing, modifiers, repeats and dialogs', () => {
    const p = props(deal52(['KS'], ['4D']));
    render(
      <>
        <WarBoard {...p} />
        <button type="button">Coach hint</button>
        <input aria-label="Comment" />
        <div role="dialog" aria-label="Rules">
          <button type="button">Close</button>
        </div>
      </>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Coach hint' }), { key: ' ' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Coach hint' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Comment' }), { key: 'f' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'f' });
    fireEvent.keyDown(document.body, { key: 'f', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'f', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'f', altKey: true });
    fireEvent.keyDown(document.body, { key: 'f', repeat: true });
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(p.onMove).not.toHaveBeenCalled();
    // The Flip button itself: Space/Enter press it natively (one click), not twice.
    fireEvent.keyDown(screen.getByTestId('war-flip'), { key: 'Enter' });
    expect(p.onMove).not.toHaveBeenCalled();
  });

  it('can be reached with Tab: Flip first, then Auto-flip', () => {
    renderBoard(deal52(['KS'], ['4D']));
    const focusable = [
      ...screen.getByTestId('war-board').querySelectorAll<HTMLElement>('button, [tabindex="0"]'),
    ];
    expect(focusable.map((el) => el.dataset.testid)).toEqual(['war-flip', 'war-auto']);
  });

  it('ignores presses once the game is over but keeps the buttons focusable', () => {
    const state = flip(deal52(['7H', '2C', '3C', '4C', 'AH'], ['7C', '5D', '6D', '8D', 'JC'], 47));
    const { onMove } = renderBoard(state);
    const button = screen.getByTestId('war-flip');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('disabled');
    expect(button).toHaveAccessibleDescription('Turn over your top card This game is over.');
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    fireEvent.click(screen.getByTestId('war-auto'));
    fireEvent.keyDown(document.body, { key: 'f' });
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('WarBoard — coach mode', () => {
  it('makes Flip glow, and pulse as the coach’s pick (coach mode only)', () => {
    const state = deal52(['KS'], ['4D']);
    const highlight = new Set(E.legalMoves(state, 0).map((m) => E.moveKey(m)));
    const { rerender } = renderBoard(state, { coachMode: true, highlight });
    expect(screen.getByTestId('war-flip')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.queryByTestId('war-suggested-ring')).not.toBeInTheDocument();

    rerender(<WarBoard {...props(state, { coachMode: true, highlight, suggestedKey: 'flip' })} />);
    const button = screen.getByTestId('war-flip');
    expect(button).toHaveAttribute('data-suggested', 'true');
    expect(within(button).getByTestId('war-suggested-ring')).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription('Turn over your top card The coach’s pick');

    rerender(<WarBoard {...props(state, { coachMode: false, highlight })} />);
    expect(screen.getByTestId('war-flip')).not.toHaveAttribute('data-highlighted');
  });
});

/** The Board wired to the real engine, the way the controller drives it. */
function Live({ initial, onMove }: { initial: WarState; onMove?: (m: WarMove) => void }) {
  const [state, setState] = useState(initial);
  const p = props(state, {
    onMove: (m: WarMove) => {
      onMove?.(m);
      setState((s) => E.applyMove(s, m));
    },
  });
  return <WarBoard {...p} />;
}

describe('WarBoard — Auto-flip', () => {
  it('plays 10 battles, one onMove at a time, then stops', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onMove = vi.fn();
    render(<Live initial={deal52(['KS'], ['4D'])} onMove={onMove} />);
    const auto = screen.getByTestId('war-auto');
    expect(auto).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(auto);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(auto).toHaveAttribute('aria-pressed', 'true');
    expect(auto).toHaveAccessibleName('Stop');

    for (let i = 1; i < AUTO_BATTLES; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTO_REDUCED_MS);
      });
    }
    expect(onMove).toHaveBeenCalledTimes(AUTO_BATTLES);
    expect(screen.getByTestId('war-counter')).toHaveTextContent('Battle 10 of 60');
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTO_REDUCED_MS);
      });
    }
    expect(onMove).toHaveBeenCalledTimes(AUTO_BATTLES);
    expect(screen.getByTestId('war-auto')).toHaveAttribute('aria-pressed', 'false');
  });

  it('stops when pressed again (or with A)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onMove = vi.fn();
    render(<Live initial={deal52(['KS'], ['4D'])} onMove={onMove} />);
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(onMove).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_REDUCED_MS);
    });
    expect(onMove).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document.body, { key: 'A' });
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTO_REDUCED_MS);
      });
    }
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('war-auto')).toHaveAttribute('aria-pressed', 'false');
  });

  it('stops at the end of the game', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onMove = vi.fn();
    render(<Live initial={deal52(['KS'], ['4D'], 26, { maxBattles: 3 })} onMove={onMove} />);
    fireEvent.click(screen.getByTestId('war-auto'));
    for (let i = 0; i < 12; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTO_REDUCED_MS);
      });
    }
    expect(onMove).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('war-board')).toHaveAttribute('data-phase', 'over');
  });
});

describe('WarBoard — the reveal', () => {
  it('flies the cards in face down, turns them over, then shows the winner and the new counts', async () => {
    useSettings.setState({ motion: 'full' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const start = deal52(['KS', '2H'], ['4D', '9C']);
    const { container, rerender, props: p } = renderBoard(start);
    const next = flip(start);
    rerender(<WarBoard {...p} {...props(next)} />);

    // Mid-flight: both cards are face down and the piles still show the old counts.
    expect(faces(container)).toEqual([]);
    expect(container.querySelectorAll('[data-face-down]').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('war-outcome')).not.toBeInTheDocument();
    expect(screen.getByTestId('war-pile-0')).toHaveAttribute('data-count', '26');
    expect(screen.getByTestId('war-pile-1')).toHaveAttribute('data-count', '26');
    // The labels already describe the battle, so screen readers never wait for the animation.
    expect(
      screen.getByRole('group', { name: 'Your cards in this battle: King of Spades' }),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(revealMs(next.lastBattle!));
    });
    expect(faces(container).sort()).toEqual(['4D', 'KS']);
    expect(screen.getByTestId('war-outcome')).toHaveTextContent('Higher card wins!');
    expect(screen.getByTestId('war-pile-0')).toHaveAttribute('data-count', '27');
    expect(screen.getByTestId('war-gain-0')).toBeInTheDocument();
  });

  it('raises the WAR! banner when the opening cards tie, then lays the war cards', async () => {
    useSettings.setState({ motion: 'full' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const start = warPosition();
    const { container, rerender, props: p } = renderBoard(start);
    const next = flip(start);
    rerender(<WarBoard {...p} {...props(next)} />);
    expect(screen.queryByTestId('war-banner')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-war-down]')).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(faces(container).sort()).toEqual(['7C', '7H']);
    expect(screen.getByTestId('war-banner')).toHaveTextContent('War!');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(container.querySelectorAll('[data-war-down]')).toHaveLength(6);
    expect(screen.queryByTestId('war-outcome')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(revealMs(next.lastBattle!));
    });
    expect(faces(container).sort()).toEqual(['7C', '7H', 'AH', 'JC']);
    expect(screen.getByTestId('war-outcome')).toHaveTextContent('You win the war!');
    for (const secret of secretsOf(WAR_DOWN)) expect(container.innerHTML).not.toContain(secret);
  });

  it('starts a fresh table for a new game', () => {
    const over = flip(deal52(['7H', '2C', '3C', '4C', 'AH'], ['7C', '5D', '6D', '8D', 'JC'], 47));
    const { rerender, props: p } = renderBoard(over);
    expect(screen.getByTestId('war-outcome')).toBeInTheDocument();
    rerender(<WarBoard {...p} {...props(deal52(['KS'], ['4D']))} />);
    expect(screen.getByTestId('war-ready')).toBeInTheDocument();
    expect(screen.getByTestId('war-counter')).toHaveTextContent('No battles yet');
  });
});
