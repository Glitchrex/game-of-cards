// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { dismissAllToasts, toast, Toaster } from './Toast';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterEach(() => {
  act(() => dismissAllToasts());
});

describe('Toaster', () => {
  it('is a polite, labelled live region that announces only new toasts', () => {
    render(<Toaster />);
    const region = screen.getByRole('status', { name: 'Notifications' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    // role=status is atomic by default, which would re-read every visible toast.
    expect(region).toHaveAttribute('aria-atomic', 'false');
    act(() => toast('Email copied!'));
    expect(region).toHaveTextContent('Email copied!');
  });

  it('auto-dismisses after its duration and keeps at most four on screen', async () => {
    render(<Toaster />);
    act(() => {
      for (let i = 1; i <= 6; i++) toast({ message: `Toast ${i}`, durationMs: 40 + i });
    });
    const shown = screen.getAllByTestId('toast').map((el) => el.textContent);
    expect(shown).toEqual(['Toast 3', 'Toast 4', 'Toast 5', 'Toast 6']);

    act(() => toast({ message: 'Sticky', tone: 'error', durationMs: 60_000 }));
    await waitFor(() =>
      expect(screen.getAllByTestId('toast').map((el) => el.textContent)).toEqual(['Sticky']),
    );
  });

  it('dismissAllToasts clears every toast', async () => {
    render(<Toaster />);
    act(() => {
      toast('One');
      toast({ message: 'Two', tone: 'info' });
    });
    expect(screen.getAllByTestId('toast')).toHaveLength(2);
    act(() => dismissAllToasts());
    await waitFor(() => expect(screen.queryByTestId('toast')).not.toBeInTheDocument());
  });
});
