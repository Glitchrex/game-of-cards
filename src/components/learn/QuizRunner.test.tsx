// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress, emptyProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { QuizRunner, scoreBandKey, type QuizQuestionData } from './QuizRunner';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  localStorage.clear();
  useProgress.setState({ games: {} });
  useSettings.setState({ motion: 'reduce' });
});

const quiz: QuizQuestionData[] = [
  {
    question: 'Best hand?',
    options: ['Trail', 'Pair', 'Colour', 'High card'],
    answer: 0,
    explanation: 'A trail beats everything.',
  },
  {
    question: 'Blind chaal costs?',
    options: ['Double', 'The stake', 'Nothing'],
    answer: 1,
    explanation: 'Blind players pay the stake.',
  },
  {
    question: 'Packing means?',
    options: ['Raising', 'Seeing', 'Folding', 'Showing'],
    answer: 2,
    explanation: 'Pack = fold.',
  },
  {
    question: 'A show needs?',
    options: ['Two players left', 'Five players', 'A joker', 'Nothing'],
    answer: 0,
    explanation: 'Only with two left.',
  },
  {
    question: 'Cards each?',
    options: ['Two', 'Four', 'Five', 'Three'],
    answer: 3,
    explanation: 'Teen means three.',
  },
];

const question = (name: string | RegExp) => screen.findByRole('heading', { level: 2, name });

function setup(props: Partial<Parameters<typeof QuizRunner>[0]> = {}) {
  const user = userEvent.setup();
  render(
    <>
      <StoreHydrator />
      <QuizRunner slug="teen-patti" name="Teen Patti" quiz={quiz} {...props} />
    </>,
  );
  return user;
}

describe('QuizRunner', () => {
  it('gives instant feedback, highlighting the right answer with text and icons', async () => {
    const user = setup();
    expect(await question(/Best hand\?/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Question 1 of 5');
    await user.click(screen.getByTestId('quiz-option-1'));

    const feedback = screen.getByTestId('quiz-feedback');
    expect(feedback).toHaveAttribute('data-tone', 'wrong');
    expect(feedback).toHaveTextContent('Not quite.');
    expect(feedback).toHaveTextContent('The right answer is “Trail”.');
    expect(feedback).toHaveTextContent('A trail beats everything.');
    expect(screen.getByTestId('quiz-option-0')).toHaveAttribute('data-state', 'correct');
    expect(screen.getByTestId('quiz-option-0')).toHaveAccessibleName(/Trail — the correct answer/);
    expect(screen.getByTestId('quiz-option-1')).toHaveAttribute('data-state', 'wrong');
    expect(screen.getByTestId('quiz-option-1')).toHaveAccessibleName(
      /Pair — your answer, incorrect/,
    );
    expect(screen.getByTestId('quiz-option-1')).toHaveTextContent('Your answer');
    expect(screen.getByTestId('quiz-option-0')).toHaveTextContent('Correct answer');

    // Next has focus so Enter keeps the quiz moving; the answer is locked in.
    expect(screen.getByTestId('quiz-next')).toHaveFocus();
    await user.click(screen.getByTestId('quiz-option-0'));
    expect(screen.getByTestId('quiz-feedback')).toHaveAttribute('data-tone', 'wrong');
    screen.getByTestId('quiz-next').focus();
    await user.keyboard('{Enter}');
    expect(await question(/Blind chaal costs\?/)).toBeInTheDocument();
  });

  it('never skips a question when Next is activated twice (double click)', async () => {
    const user = setup();
    await question(/Best hand\?/);
    await user.click(screen.getByTestId('quiz-option-0'));
    const next = screen.getByTestId('quiz-next');
    // Both clicks hit the same (outgoing) button before React re-renders.
    fireEvent.click(next);
    fireEvent.click(next);
    expect(await question(/Blind chaal costs\?/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Question 2 of 5');
  });

  it('answers with the 1–4 keys and moves between options with the arrow keys', async () => {
    const user = setup();
    await question(/Best hand\?/);
    // Roving tabindex: one Tab lands on the first option.
    await user.tab();
    const first = screen.getByTestId('quiz-option-0');
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('quiz-option-1')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByTestId('quiz-option-3')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
    await user.keyboard('1');
    expect(screen.getByTestId('quiz-feedback')).toHaveAttribute('data-tone', 'right');
    expect(screen.getByTestId('quiz-feedback')).toHaveTextContent('Correct!');
  });

  it('scores the quiz, records the best score and offers a retry', async () => {
    const user = setup({ playable: true });
    // Right, wrong, right, right, right → 4/5.
    const picks = [0, 0, 2, 0, 3];
    for (const [i, pick] of picks.entries()) {
      await screen.findByTestId(`quiz-option-${pick}`);
      await user.click(screen.getByTestId(`quiz-option-${pick}`));
      expect(screen.getByTestId('quiz-next')).toHaveTextContent(
        i === picks.length - 1 ? 'See my score' : 'Next question',
      );
      await user.click(screen.getByTestId('quiz-next'));
    }
    const score = await screen.findByTestId('quiz-score');
    expect(score).toHaveTextContent(/^4\/5$/);
    expect(screen.getByRole('heading', { level: 2 })).toHaveAccessibleName(
      'Your score: You scored 4 out of 5.',
    );
    expect(screen.getByText(/So close to perfect/)).toBeInTheDocument();
    await waitFor(() => expect(useProgress.getState().games['teen-patti']?.quizBest).toBe(4));
    expect(screen.getByTestId('quiz-best')).toHaveTextContent('New personal best! Your best: 4/5');
    expect(screen.getByRole('link', { name: 'Play vs bot' })).toHaveAttribute(
      'href',
      '/games/teen-patti/play',
    );
    expect(screen.getByRole('link', { name: 'Review the lesson' })).toHaveAttribute(
      'href',
      '/games/teen-patti/learn',
    );

    await user.click(screen.getByTestId('quiz-retry'));
    expect(await question(/Best hand\?/)).toBeInTheDocument();
    // A worse retry never lowers the best score.
    for (const pick of [1, 0, 0, 1, 0]) {
      await screen.findByTestId(`quiz-option-${pick}`);
      await user.click(screen.getByTestId(`quiz-option-${pick}`));
      await user.click(screen.getByTestId('quiz-next'));
    }
    expect(await screen.findByTestId('quiz-score')).toHaveTextContent('0/5');
    await waitFor(() =>
      expect(screen.getByTestId('quiz-best')).toHaveTextContent('Your best: 4/5'),
    );
    expect(screen.getByTestId('quiz-best')).not.toHaveTextContent('New personal best');
    expect(useProgress.getState().games['teen-patti']?.quizBest).toBe(4);
  });

  it('hides the play link for games without a bot table', async () => {
    useProgress.setState({ games: { 'teen-patti': { ...emptyProgress(), quizBest: 5 } } });
    const user = setup();
    for (const q of quiz) {
      await screen.findByTestId(`quiz-option-${q.answer}`);
      await user.click(screen.getByTestId(`quiz-option-${q.answer}`));
      await user.click(screen.getByTestId('quiz-next'));
    }
    expect(await screen.findByTestId('quiz-score')).toHaveTextContent('5/5');
    expect(screen.getByText(/A perfect score!/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Play vs bot' })).not.toBeInTheDocument();
  });

  it('picks a fun line per score band', () => {
    expect(scoreBandKey(5, 5)).toBe('learn.quiz.band5');
    expect(scoreBandKey(4, 5)).toBe('learn.quiz.band4');
    expect(scoreBandKey(3, 5)).toBe('learn.quiz.band3');
    expect(scoreBandKey(2, 5)).toBe('learn.quiz.band2');
    expect(scoreBandKey(1, 5)).toBe('learn.quiz.band0');
    expect(scoreBandKey(0, 5)).toBe('learn.quiz.band0');
  });
});
