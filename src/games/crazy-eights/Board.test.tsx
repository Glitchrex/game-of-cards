// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { seatPersonas } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { useSettings } from '@/store/settings';
import { CrazyEightsBoard, type CrazyEightsBoardProps } from './Board';
import { crazyEightsEngine as E, type CrazyEightsState } from './engine';
import { CRAZY_EIGHTS_BOTS, JUGNU_JUGGLER, MADAME_MATINEE } from './personas';
import { cards, makeState } from './test-helpers';

const PERSONAS = seatPersonas(CRAZY_EIGHTS_BOTS.slice(0, 2));

function props(state: CrazyEightsState, extra: Partial<CrazyEightsBoardProps> = {}) {
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
  } satisfies CrazyEightsBoardProps;
}

function renderBoard(state: CrazyEightsState, extra: Partial<CrazyEightsBoardProps> = {}) {
  const p = props(state, extra);
  const view = render(<CrazyEightsBoard {...p} />);
  return { ...view, onMove: p.onMove, props: p };
}

/** Coach-mode props: every legal move glows. */
function coached(state: CrazyEightsState, suggestedKey: string | null = null) {
  return {
    coachMode: true,
    highlight: new Set(E.legalMoves(state, 0).map((m) => E.moveKey(m))),
    suggestedKey,
  };
}

/**
 * The learner holds 2♠ K♠ 8♥ 7♣ Q♦ on a K♦ (so K♠, Q♦ and the 8♥ fit); the bots hold five
 * cards each and the stock starts with the 9♦ and the J♠.
 */
const SPEC = {
  hands: ['2S KS 8H 7C QD', '3H 4H 5C 6C 9S', 'AH TC JC 2D 4D'],
  top: 'KD',
};
const opening = () => makeState(SPEC);

const card = (code: CardCode) => screen.getByRole('button', { name: new RegExp(cardName(code)) });

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  useSettings.setState({ motion: 'reduce' });
});

describe('CrazyEightsBoard — the table', () => {
  it('seats the bots with names and taglines, holding card backs and a count only', () => {
    const state = opening();
    const { container } = renderBoard(state);
    const jugnu = screen.getByTestId('c8-seat-1');
    expect(within(jugnu).getByText(JUGNU_JUGGLER.name)).toBeInTheDocument();
    expect(within(jugnu).getByText(JUGNU_JUGGLER.tagline)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('c8-seat-2')).getByText(MADAME_MATINEE.name),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Jugnu the Juggler holds 5 cards' })).toHaveAttribute(
      'data-count',
      '5',
    );
    expect(screen.getByTestId('c8-count-2')).toHaveTextContent('5 cards');

    // Only the learner's cards and the discard pile have faces on the table.
    const faces = [...container.querySelectorAll('[data-card]')].map((el) =>
      el.getAttribute('data-card'),
    );
    expect(faces.sort()).toEqual([...cards('2S KS 8H 7C QD'), 'KD'].sort());
    // Nothing the learner can't see — bots' hands, the stock — reaches the DOM.
    const hidden = [...state.hands[1]!, ...state.hands[2]!, ...state.stock];
    for (const code of hidden) {
      expect(container.innerHTML).not.toContain(`"${code}"`);
      expect(container.textContent).not.toContain(cardName(code));
    }
  });

  it('labels the zones for screen readers: hand, discard pile, stock and table rules', () => {
    renderBoard(opening());
    expect(
      screen.getByRole('toolbar', {
        name: 'Your hand: Two of Spades, King of Spades, Eight of Hearts, Seven of Clubs and Queen of Diamonds',
      }),
    ).toBeInTheDocument();
    const pile = screen.getByTestId('c8-discard');
    expect(pile).toHaveAccessibleName(
      'Discard pile, 1 card. Top card: King of Diamonds. Next card: a Diamond or a King, or a wild Eight.',
    );
    expect(pile).toHaveAttribute('data-suit', 'D');
    expect(screen.getByTestId('c8-need')).toHaveAttribute('data-rank', 'K');
    expect(screen.getByTestId('c8-draw')).toHaveAccessibleName(
      'Draw a card from the stock, 36 left',
    );
    expect(screen.getByRole('group', { name: 'The middle of the table' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Table rules: match the top card’s suit or rank. Eights are wild and name the next suit.',
      ),
    ).toHaveClass('sr-only');
  });

  it('shows the named suit in a big badge after an Eight', () => {
    renderBoard(
      makeState({
        hands: ['2S KS 7C', '3H 4H', 'AH TC'],
        top: '8C',
        activeSuit: 'H',
        namedBy: 2,
      }),
    );
    const badge = screen.getByTestId('c8-suit-badge');
    expect(badge).toHaveAttribute('data-suit', 'H');
    expect(badge).toHaveTextContent('Suit is now');
    expect(badge).toHaveTextContent('Hearts');
    expect(screen.queryByTestId('c8-need')).not.toBeInTheDocument();
    expect(screen.getByTestId('c8-discard')).toHaveAccessibleName(
      /The suit is now Hearts: play a Heart or another Eight\./,
    );
  });

  it('shouts "2 cards left!" and "Last card!" for a seat that is nearly out', () => {
    renderBoard(makeState({ hands: ['2S KS 7C', '3H 4H', 'AH'], top: 'KD' }));
    expect(screen.getByTestId('c8-count-1')).toHaveTextContent('2 cards left!');
    expect(screen.getByTestId('c8-count-2')).toHaveTextContent('Last card!');
    expect(screen.getByTestId('c8-count-2')).toHaveAttribute('data-last', 'true');
  });

  it('celebrates the learner’s own last card', () => {
    renderBoard(makeState({ hands: ['KS', '3H 4H 9C', 'AH 2C 3C'], top: 'KD' }));
    expect(screen.getByTestId('c8-last-card')).toHaveTextContent('Last card!');
    expect(screen.getByTestId('c8-count-0')).toHaveTextContent('Last card!');
  });

  it('shows the thinking bot with dots and keeps every input waiting', () => {
    const state = makeState({ ...SPEC, turn: 1 });
    const { onMove } = renderBoard(state);
    const seat = screen.getByTestId('c8-seat-1');
    expect(seat).toHaveAttribute('data-thinking', 'true');
    expect(seat).toHaveAttribute('data-active', 'true');
    expect(within(seat).getByTestId('thinking-dots')).toBeInTheDocument();
    expect(screen.getByTestId('c8-seat-2')).not.toHaveAttribute('data-thinking');
    expect(screen.getByTestId('c8-you')).not.toHaveAttribute('data-active');

    expect(screen.getByTestId('c8-draw')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('c8-pass')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('c8-hand')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByTestId('c8-draw'));
    fireEvent.click(screen.getByTestId('c8-pass'));
    fireEvent.click(card('KS'));
    fireEvent.keyDown(document.body, { key: 'd' });
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('c8-draw')).toHaveAccessibleDescription(
      'Wait — Jugnu the Juggler is playing.',
    );
  });

  it('shows the learner the card they just drew', () => {
    const state = opening();
    const next = state.stock[0]!;
    renderBoard(E.applyMove(state, { type: 'draw' }));
    expect(screen.getByTestId('c8-drawn')).toHaveAttribute('data-card', next);
    expect(screen.getByTestId('c8-drawn')).toHaveTextContent(`You just drew the ${cardName(next)}`);
  });

  it('turns the bots’ cards face up once the game is over, with points in a blocked game', () => {
    const blocked: CrazyEightsState = {
      ...makeState({ hands: ['2S 3S', '4H 5H', 'TC'], top: 'KD', stock: '' }),
      phase: 'over',
      winners: [0],
      endReason: 'blocked',
    };
    renderBoard(blocked);
    expect(
      screen.getByRole('img', {
        name: 'Jugnu the Juggler’s cards: Four of Hearts and Five of Hearts',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('c8-points-1')).toHaveAttribute('data-points', '9');
    expect(screen.getByTestId('c8-points-2')).toHaveTextContent('10 pts');
    expect(screen.getByTestId('c8-you-won')).toHaveTextContent('You went out!');
  });

  it('marks the bot that went out as the winner', () => {
    const won: CrazyEightsState = {
      ...makeState({ hands: ['2S 3S', '', 'TC 4C'], top: 'KD' }),
      phase: 'over',
      winners: [1],
      endReason: 'out',
    };
    renderBoard(won);
    expect(screen.getByTestId('c8-count-1')).toHaveTextContent('Out — winner!');
    expect(
      screen.getByRole('img', { name: 'Jugnu the Juggler has no cards left' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('c8-points-1')).not.toBeInTheDocument();
  });
});

describe('CrazyEightsBoard — moves', () => {
  it('plays a card that fits — and lets the learner attempt one that does not', () => {
    const { onMove } = renderBoard(opening());
    fireEvent.click(card('QD'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'play', card: 'QD' });
    fireEvent.click(card('7C'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'play', card: '7C' });
  });

  it('draws from the stock and passes (the controller explains when passing is not allowed)', () => {
    const { onMove } = renderBoard(opening());
    fireEvent.click(screen.getByTestId('c8-draw'));
    expect(onMove).toHaveBeenLastCalledWith({ type: 'draw' });
    const pass = screen.getByTestId('c8-pass');
    expect(pass).toHaveAttribute('aria-disabled', 'true');
    expect(pass).toHaveAccessibleDescription(
      'Only when stuck Not available right now — press it and the coach explains why.',
    );
    fireEvent.click(pass);
    expect(onMove).toHaveBeenLastCalledWith({ type: 'pass' });
  });

  it('makes Pass the main action when the stock is empty and nothing fits', () => {
    // The learner's 2♠ 3♠ can't go on the K♦ and the stock is empty; Jugnu's 5♦ still fits,
    // so the game is not blocked — the learner simply has to pass.
    const state = makeState({ hands: ['2S 3S', '4H 5D', 'TC'], top: 'KD', stock: '' });
    const { onMove } = renderBoard(state);
    const pass = screen.getByTestId('c8-pass');
    expect(pass).toHaveAttribute('data-legal', 'true');
    expect(pass).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('c8-draw')).toHaveAccessibleName('Draw a card: The stock is empty');
    fireEvent.click(pass);
    expect(onMove).toHaveBeenCalledWith({ type: 'pass' });
  });

  it('opens the suit chooser for an Eight and plays it with the named suit', () => {
    const { onMove } = renderBoard(opening());
    fireEvent.click(card('8H'));
    expect(onMove).not.toHaveBeenCalled();
    const chooser = screen.getByRole('group', { name: 'Name the next suit' });
    expect(chooser).toHaveAccessibleDescription(
      'Your 8♥ is wild. Which suit must the next player follow?',
    );
    // Focus moves into the chooser; each suit says how many the learner would still hold.
    expect(screen.getByTestId('c8-suit-S')).toHaveFocus();
    expect(screen.getByTestId('c8-suit-S')).toHaveAccessibleName('Spades (You hold 2)');
    expect(screen.getByTestId('c8-suit-H')).toHaveAccessibleName('Hearts (You hold 0)');
    expect(screen.getByTestId('c8-suit-C')).toHaveAccessibleName('Clubs (You hold 1)');

    fireEvent.click(screen.getByTestId('c8-suit-C'));
    expect(onMove).toHaveBeenCalledWith({ type: 'play', card: '8H', suit: 'C' });
    expect(screen.queryByTestId('c8-suit-chooser')).not.toBeInTheDocument();
  });

  it('closes the suit chooser with "Back to my hand" and returns focus to the Eight', () => {
    const { onMove } = renderBoard(opening());
    fireEvent.click(card('8H'));
    fireEvent.click(screen.getByTestId('c8-suit-cancel'));
    expect(screen.queryByTestId('c8-suit-chooser')).not.toBeInTheDocument();
    expect(card('8H')).toHaveFocus();
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('CrazyEightsBoard — keyboard', () => {
  it('plays from the hand with arrows and Enter, and draws with D', () => {
    const { onMove } = renderBoard(opening());
    const first = card('2S');
    act(() => first.focus());
    const hand = screen.getByTestId('c8-hand');
    fireEvent.keyDown(hand, { key: 'ArrowRight' });
    expect(card('KS')).toHaveFocus();
    fireEvent.keyDown(hand, { key: 'End' });
    expect(card('QD')).toHaveFocus();
    // A real keyboard press activates the focused <button> with a click.
    fireEvent.click(document.activeElement!);
    expect(onMove).toHaveBeenLastCalledWith({ type: 'play', card: 'QD' });

    fireEvent.keyDown(document.body, { key: 'd' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'draw' });
    fireEvent.keyDown(document.body, { key: 'P' });
    expect(onMove).toHaveBeenLastCalledWith({ type: 'pass' });
    // Modifier keys and key repeat are left alone.
    fireEvent.keyDown(document.body, { key: 'd', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'd', repeat: true });
    expect(onMove).toHaveBeenCalledTimes(3);
  });

  it('keeps focus on the table (not the page) after the last card is played', () => {
    const state = makeState({ hands: ['QD', '3H 4H 5C 6C 9S', 'AH TC JC 2D 4D'], top: 'KD' });
    const { rerender, props: p } = renderBoard(state);
    act(() => card('QD').focus());
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    fireEvent.click(document.activeElement!);
    expect(p.onMove).toHaveBeenLastCalledWith({ type: 'play', card: 'QD' });
    const after = E.applyMove(state, { type: 'play', card: 'QD' });
    rerender(<CrazyEightsBoard {...props(after)} />);
    expect(screen.getByRole('group', { name: 'Crazy Eights board' })).toHaveFocus();
    expect(screen.getByTestId('c8-you-won')).toBeInTheDocument();
  });

  it('names a suit with S/H/D/C while the chooser is open, and Esc goes back', () => {
    const { onMove } = renderBoard(opening());
    fireEvent.click(card('8H'));
    // Arrow keys move between the suits.
    fireEvent.keyDown(screen.getByTestId('c8-suit-S'), { key: 'ArrowRight' });
    expect(screen.getByTestId('c8-suit-H')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('c8-suit-H'), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByTestId('c8-suit-S'), { key: 'ArrowLeft' });
    expect(screen.getByTestId('c8-suit-C')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('c8-suit-C'), { key: 'Escape' });
    expect(screen.queryByTestId('c8-suit-chooser')).not.toBeInTheDocument();
    expect(card('8H')).toHaveFocus();

    fireEvent.click(card('8H'));
    // D names Diamonds here (it does not draw while the chooser is open).
    fireEvent.keyDown(screen.getByTestId('c8-suit-S'), { key: 'd' });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith({ type: 'play', card: '8H', suit: 'D' });
  });

  it('ignores shortcuts typed into a text field', () => {
    const { onMove } = renderBoard(opening());
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'd' });
    expect(onMove).not.toHaveBeenCalled();
    input.remove();
  });
});

describe('CrazyEightsBoard — coach mode', () => {
  it('glows every playable card and the stock, and dims the rest', () => {
    const state = opening();
    renderBoard(state, coached(state));
    for (const code of cards('KS 8H QD')) {
      expect(card(code)).toHaveAttribute('data-highlighted', 'true');
    }
    for (const code of cards('2S 7C')) {
      expect(card(code)).not.toHaveAttribute('data-highlighted');
      expect(card(code)).toHaveAttribute('data-dimmed', 'true');
    }
    expect(screen.getByTestId('c8-draw')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('c8-pass')).not.toHaveAttribute('data-highlighted');
  });

  it('nothing glows outside coach mode', () => {
    renderBoard(opening());
    expect(card('KS')).not.toHaveAttribute('data-highlighted');
    expect(card('7C')).not.toHaveAttribute('data-dimmed');
    expect(screen.getByTestId('c8-draw')).not.toHaveAttribute('data-highlighted');
  });

  it('pulses the coach’s pick: a card, the stock or Pass', () => {
    const state = opening();
    const { rerender, props: p } = renderBoard(state, coached(state, 'play:KS'));
    expect(card('KS')).toHaveAttribute('data-suggested', 'true');
    expect(card('QD')).not.toHaveAttribute('data-suggested');

    rerender(<CrazyEightsBoard {...p} suggestedKey="draw" />);
    expect(screen.getByTestId('c8-draw')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('c8-draw')).toHaveAccessibleDescription('The coach’s pick');
    expect(card('KS')).not.toHaveAttribute('data-suggested');

    rerender(<CrazyEightsBoard {...p} suggestedKey="pass" />);
    expect(screen.getByTestId('c8-pass')).toHaveAttribute('data-suggested', 'true');
  });

  it('pulses an Eight the coach wants played, then the suit it should name', () => {
    const state = opening();
    renderBoard(state, coached(state, 'play:8H:C'));
    expect(card('8H')).toHaveAttribute('data-suggested', 'true');
    fireEvent.click(card('8H'));
    for (const suit of ['S', 'H', 'D', 'C']) {
      expect(screen.getByTestId(`c8-suit-${suit}`)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.getByTestId('c8-suit-C')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('c8-suit-H')).not.toHaveAttribute('data-suggested');
    // Focus opens on the coach's pick.
    expect(screen.getByTestId('c8-suit-C')).toHaveFocus();
    expect(screen.getByTestId('c8-suit-C')).toHaveAccessibleDescription('The coach’s pick');
  });
});

describe('CrazyEightsBoard — motion', () => {
  it('flies a card back (never the card) from the stock when a bot draws', () => {
    useSettings.setState({ motion: 'full' });
    const state = makeState({ ...SPEC, turn: 1 });
    const { rerender, props: p, container } = renderBoard(state);
    expect(screen.queryByTestId('c8-draw-flight')).not.toBeInTheDocument();
    const drew = E.applyMove(state, { type: 'draw' });
    rerender(<CrazyEightsBoard {...p} state={drew} />);
    expect(screen.getByTestId('c8-draw-flight')).toBeInTheDocument();
    const secret = state.stock[0]!;
    expect(container.innerHTML).not.toContain(`"${secret}"`);
    expect(container.textContent).not.toContain(cardName(secret));
  });

  it('a played card lands on top of the pile', () => {
    useSettings.setState({ motion: 'full' });
    const state = opening();
    const { rerender, props: p } = renderBoard(state);
    const played = E.applyMove(state, { type: 'play', card: 'KS' });
    rerender(<CrazyEightsBoard {...p} state={played} busy thinking={1} />);
    expect(screen.getByTestId('c8-discard')).toHaveAttribute('data-top', 'KS');
    expect(screen.getByTestId('c8-discard')).toHaveAttribute('data-suit', 'S');
    expect(screen.getByTestId('c8-hand')).toHaveAccessibleName(
      'Your hand: Two of Spades, Eight of Hearts, Seven of Clubs and Queen of Diamonds',
    );
  });
});
