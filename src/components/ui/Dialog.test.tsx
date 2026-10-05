// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

function Harness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open wallet</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Your Jeet wallet"
        description="Pretend money only."
        dismissible={dismissible}
        footer={<Button onClick={() => setOpen(false)}>Done</Button>}
      >
        <p>Balance: 1,000</p>
        <a href="/games">Find a game</a>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('is an aria-modal dialog labelled by its title and described by its description', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open wallet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Your Jeet wallet' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Pretend money only.');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape and restores focus to the opener', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open wallet' });
    await user.click(opener);
    await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('traps Tab and Shift+Tab inside the panel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open wallet' }));
    const dialog = await screen.findByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    const done = screen.getByRole('button', { name: 'Done' });

    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Find a game' })).toHaveFocus();
    await user.tab();
    expect(done).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(done).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes from the close button and the backdrop, but not when non-dismissible', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    unmount();

    render(<Harness dismissible={false} />);
    await user.click(screen.getByRole('button', { name: 'Open wallet' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
