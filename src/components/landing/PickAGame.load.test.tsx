// @vitest-environment jsdom
/**
 * The "Pick a game for me" dialog chunk is fetched on demand. When that fetch fails (flaky
 * connection, a deploy swapped the chunks), the visitor gets a friendly toast and the very
 * next click tries again — the failure is never cached.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { Toaster, dismissAllToasts } from '@/components/ui/Toast';
import { PickAGame } from './PickAGame';
import { toPickableGame } from './pick-data';
import { FIXTURE_GAMES } from './test-fixtures';

const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));

vi.mock('./PickAGameDialog', async (importOriginal) => {
  chunk.loads += 1;
  if (chunk.fail) throw new Error('Failed to fetch dynamically imported module');
  return importOriginal();
});

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterEach(() => dismissAllToasts());

describe('PickAGame lazy loading', () => {
  it('shows a toast when the dialog cannot load, then retries on the next click', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PickAGame games={FIXTURE_GAMES.map(toPickableGame)} />
        <Toaster />
      </>,
    );
    const trigger = screen.getByTestId('cta-pick');

    await user.click(trigger);
    expect(
      await screen.findByText('Couldn’t reach the server. Check your connection and try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The button is usable again (no stuck spinner).
    await waitFor(() => expect(trigger).not.toHaveAttribute('aria-busy'));
    const failedLoads = chunk.loads;
    expect(failedLoads).toBeGreaterThanOrEqual(1);

    chunk.fail = false;
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Pick a game for me' })).toBeInTheDocument();
    expect(chunk.loads).toBeGreaterThan(failedLoads);
  });
});
