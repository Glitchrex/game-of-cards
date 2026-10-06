// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { Popover } from './Popover';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

describe('Popover', () => {
  it('toggles on click with aria-expanded/aria-controls and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Settings" title="Table settings">
        <button type="button">Inside</button>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Settings' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // No dangling IDREF while the panel isn't rendered.
    expect(trigger).not.toHaveAttribute('aria-controls');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('dialog', { name: 'Table settings' });
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    // A titled popover is a dialog: opening it moves focus inside.
    expect(panel).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on keyboard focus (openOnFocus) and closes when focus moves away', async () => {
    const user = userEvent.setup();
    render(
      <p>
        A{' '}
        <Popover inline openOnFocus trigger="trail">
          Three cards of the same rank.
        </Popover>{' '}
        beats everything. <a href="#games">Next</a>
      </p>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'trail' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Three cards of the same rank.')).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveFocus();
    await waitFor(() =>
      expect(screen.queryByText('Three cards of the same rank.')).not.toBeInTheDocument(),
    );
  });

  it('opens with ArrowDown from the keyboard and keeps focus on the trigger when untitled', async () => {
    const user = userEvent.setup();
    render(<Popover trigger="Info">Details</Popover>);
    const trigger = screen.getByRole('button', { name: 'Info' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Popover trigger="Info">Details</Popover>
        <span>Outside</span>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Info' }));
    expect(screen.getByText('Details')).toBeInTheDocument();
    await user.click(screen.getByText('Outside'));
    await waitFor(() => expect(screen.queryByText('Details')).not.toBeInTheDocument());
  });
});
