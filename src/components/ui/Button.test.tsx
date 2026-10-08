// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { Chip } from './Chip';
import { ProgressBar } from './ProgressBar';
import { TextField } from './Field';

describe('Button', () => {
  it('renders a type=button by default and a link when href is set', () => {
    render(
      <>
        <Button>Deal</Button>
        <Button href="/games">Games</Button>
        <Button href="https://example.com" target="_blank" rel="noopener noreferrer">
          External
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Deal' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('link', { name: 'Games' })).toHaveAttribute('href', '/games');
    expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute('target', '_blank');
  });

  it('keeps focus and ignores clicks while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Sending…" onClick={onClick}>
        Send
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /Send/ });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).not.toBeDisabled();
    btn.focus();
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('exposes its toggle state with aria-pressed', async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    render(
      <Chip selected={false} onSelectedChange={onSelectedChange}>
        Europe
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Europe' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(onSelectedChange).toHaveBeenCalledWith(true);
  });
});

describe('ProgressBar', () => {
  it('reports its value to assistive tech', () => {
    render(<ProgressBar label="Lesson progress" value={3} max={8} valueText="Step 3 of 8" />);
    const bar = screen.getByRole('progressbar', { name: 'Lesson progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '8');
    expect(bar).toHaveAttribute('aria-valuetext', 'Step 3 of 8');
  });
});

describe('TextField', () => {
  it('wires label, hint, error and counter', async () => {
    const user = userEvent.setup();
    render(
      <TextField
        label="Title"
        hint="Short headline"
        error="Title is required."
        maxLength={120}
        showCount
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      /Title is required\. Short headline 0 of 120 characters used/,
    );
    await user.type(input, 'Uno');
    expect(screen.getByText('3/120')).toBeInTheDocument();
  });
});
