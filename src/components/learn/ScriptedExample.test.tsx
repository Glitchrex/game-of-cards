// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { ScriptedExample, type ScriptedExampleData } from './ScriptedExample';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useProgress.setState({ games: {} });
  useSettings.setState({ motion: 'reduce' });
});

const glossary = [
  { term: 'trump', definition: 'The boss suit.' },
  { term: 'attacker', definition: 'The player who leads cards.' },
];

const example: ScriptedExampleData = {
  intro: 'A two-player hand of Durak. You make the big calls.',
  steps: [
    {
      narration: 'Hearts are [[trump]]. You are the [[attacker]].',
      scene: {
        zones: [{ id: 'hand', label: 'Your hand', cards: ['6H', '7S', 'KS'], layout: 'fan' }],
      },
      decision: {
        prompt: 'Which card do you attack with?',
        options: [
          { label: 'The 6♥', card: '6H', correct: false, feedback: 'That is a trump — keep it.' },
          { label: 'The 7♠', card: '7S', correct: true, feedback: 'A low non-trump. Great start!' },
          { label: 'The K♠', card: 'KS', correct: false, feedback: 'Kings defend well.' },
        ],
        proHint: 'Open with your lowest non-trump card.',
      },
    },
    {
      narration: 'Your opponent beats it with the J♠.',
      scene: {
        zones: [{ id: 'table', label: 'Table', cards: ['7S', 'JS'], layout: 'row' }],
      },
    },
    {
      narration: 'You end the attack.',
      scene: { zones: [{ id: 'table', label: 'Table', cards: ['7S', 'JS'] }] },
    },
    {
      narration: 'Cards are refilled from the stock.',
      scene: { zones: [{ id: 'hand', label: 'Your hand', cards: ['KS', '9D'] }] },
    },
  ],
  outro: 'You played a whole hand of Durak!',
};

function setup() {
  const user = userEvent.setup();
  render(
    <>
      <StoreHydrator />
      <ScriptedExample
        slug="durak"
        name="Durak"
        glossary={glossary}
        example={example}
        tips={['Tip: save your trumps for defence.', 'Tip: second tip']}
      />
    </>,
  );
  return user;
}

describe('ScriptedExample', () => {
  it('starts on an intro card and marks the game started', async () => {
    const user = setup();
    expect(
      await screen.findByRole('heading', { name: 'Let’s play a hand of Durak together' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A two-player hand of Durak. You make the big calls.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(useProgress.getState().games.durak?.started).toBe(true));
    await user.click(screen.getByTestId('example-continue'));
    const heading = await screen.findByRole('heading', { name: /Step 1 of 4/ });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 1 of 4');
    // Narration with glossary terms sits in the coach panel.
    const coach = screen.getByTestId('coach-panel');
    expect(within(coach).getByRole('button', { name: 'trump' })).toBeInTheDocument();
    // The coach panel clips overflow by default, which would cut glossary popovers off.
    expect(coach).toHaveClass('overflow-visible!');
    expect(screen.getByText(/Your hand: Six of Hearts/)).toBeInTheDocument();
  });

  it('makes the learner choose: wrong picks explain why, the right pick unlocks Continue', async () => {
    const user = setup();
    await user.click(await screen.findByTestId('example-continue'));
    await screen.findByRole('heading', { name: /Step 1 of 4/ });

    // Must choose before continuing.
    expect(screen.queryByTestId('example-continue')).not.toBeInTheDocument();
    expect(screen.getByTestId('example-must-choose')).toHaveTextContent(
      'Make your choice to continue.',
    );
    expect(
      screen.getByRole('group', { name: /Which card do you attack with\?/ }),
    ).toBeInTheDocument();

    // Wrong pick: feedback + try again; that option is marked as tried.
    await user.click(screen.getByTestId('example-option-0'));
    const wrong = screen.getByTestId('example-feedback');
    expect(wrong).toHaveAttribute('data-tone', 'wrong');
    expect(wrong).toHaveTextContent('Not quite.');
    expect(wrong).toHaveTextContent('That is a trump — keep it.');
    expect(wrong).toHaveTextContent('Have another go.');
    expect(screen.getByTestId('example-option-0')).toHaveAttribute('data-state', 'tried');
    expect(screen.getByTestId('example-option-0')).toHaveAccessibleName(
      /The 6♥ — tried — not this one/,
    );
    expect(screen.queryByTestId('example-continue')).not.toBeInTheDocument();

    // Another wrong pick, then the right one.
    await user.click(screen.getByTestId('example-option-2'));
    expect(screen.getByTestId('example-feedback')).toHaveTextContent('Kings defend well.');
    await user.click(screen.getByTestId('example-option-1'));
    const right = screen.getByTestId('example-feedback');
    expect(right).toHaveAttribute('data-tone', 'right');
    expect(right).toHaveTextContent('Nice call!');
    expect(right).toHaveTextContent('A low non-trump. Great start!');
    expect(screen.getByTestId('example-option-1')).toHaveAttribute('data-state', 'solved');
    // Earlier wrong picks stay marked; nothing else can be picked now.
    expect(screen.getByTestId('example-option-0')).toHaveAttribute('data-state', 'tried');
    expect(screen.getByTestId('example-option-2')).toHaveAttribute('data-state', 'tried');
    const next = screen.getByTestId('example-continue');
    await waitFor(() => expect(next).toHaveFocus());

    await user.click(next);
    expect(await screen.findByRole('heading', { name: /Step 2 of 4/ })).toBeInTheDocument();
    // Back keeps the solved decision.
    await user.click(screen.getByTestId('example-back'));
    await screen.findByRole('heading', { name: /Step 1 of 4/ });
    expect(screen.getByTestId('example-option-1')).toHaveAttribute('data-state', 'solved');
    expect(screen.getByTestId('example-continue')).toBeInTheDocument();
  });

  it('reveals the pro hint on demand', async () => {
    const user = setup();
    await user.click(await screen.findByTestId('example-continue'));
    await screen.findByRole('heading', { name: /Step 1 of 4/ });
    const hint = screen.getByTestId('example-pro-hint');
    expect(hint).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Open with your lowest non-trump card.')).not.toBeInTheDocument();
    await user.click(hint);
    expect(hint).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('example-pro-hint-text')).toHaveTextContent(
      'Pro tip: Open with your lowest non-trump card.',
    );
    await user.click(hint);
    expect(screen.queryByTestId('example-pro-hint-text')).not.toBeInTheDocument();
  });

  it('steps without a decision continue straight away; the end marks the example done', async () => {
    const user = setup();
    await user.click(await screen.findByTestId('example-continue'));
    await screen.findByRole('heading', { name: /Step 1 of 4/ });
    await user.click(screen.getByTestId('example-option-1'));
    await user.click(screen.getByTestId('example-continue'));
    for (const n of [2, 3, 4]) {
      await screen.findByRole('heading', { name: new RegExp(`Step ${n} of 4`) });
      expect(screen.queryByTestId('example-option-0')).not.toBeInTheDocument();
      expect(useProgress.getState().games.durak?.exampleDone).toBe(false);
      await user.click(screen.getByTestId('example-continue'));
    }
    const outro = await screen.findByTestId('example-outro');
    expect(outro).toHaveTextContent('That’s the hand!');
    await waitFor(() => expect(outro).toHaveFocus());
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Hand complete');
    expect(screen.getByTestId('example-progress')).toHaveAttribute('data-step', '4');
    expect(screen.getByText('You played a whole hand of Durak!')).toBeInTheDocument();
    expect(screen.getByText('Save your trumps for defence.')).toBeInTheDocument();
    expect(screen.queryByText(/Tip: save/)).not.toBeInTheDocument();
    await waitFor(() => expect(useProgress.getState().games.durak?.exampleDone).toBe(true));
    expect(screen.getByTestId('rating-prompt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Take the quiz' })).toHaveAttribute(
      'href',
      '/games/durak/quiz',
    );
    expect(screen.getByRole('link', { name: 'Review the lesson' })).toHaveAttribute(
      'href',
      '/games/durak/learn',
    );

    await user.click(screen.getByRole('button', { name: 'Replay this hand' }));
    expect(
      await screen.findByRole('heading', { name: 'Let’s play a hand of Durak together' }),
    ).toBeInTheDocument();
  });
});
