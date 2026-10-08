// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { Badge } from './Badge';
import { Select, TextArea } from './Field';
import { IconButton } from './IconButton';
import { Segmented } from './Segmented';
import { Spinner } from './Spinner';
import { Switch } from './Switch';
import { Tabs } from './Tabs';
import { VisuallyHidden } from './VisuallyHidden';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

describe('Switch', () => {
  it('is a labelled role=switch with its hint as description, toggled by click or label', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <Switch
          checked={on}
          onCheckedChange={setOn}
          label="Four-colour deck"
          hint="Easier to tell suits apart."
        />
      );
    }
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Four-colour deck' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAccessibleDescription('Easier to tell suits apart.');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByText('Four-colour deck'));
    expect(sw).toHaveAttribute('aria-checked', 'false');
    sw.focus();
    await user.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Segmented', () => {
  it('is a fieldset of native radios: one tab stop, arrow keys change the value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Harness() {
      const [v, setV] = useState<'system' | 'reduce' | 'full'>('system');
      return (
        <Segmented
          legend="Motion"
          hint="System follows your device."
          value={v}
          onValueChange={(next) => {
            setV(next);
            onValueChange(next);
          }}
          options={[
            { value: 'system', label: 'System' },
            { value: 'reduce', label: 'Reduce' },
            { value: 'full', label: 'Full' },
          ]}
        />
      );
    }
    render(
      <>
        <button type="button">Before</button>
        <Harness />
      </>,
    );
    const group = screen.getByRole('group', { name: 'Motion' });
    expect(group).toHaveAccessibleDescription('System follows your device.');
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(screen.getByRole('radio', { name: 'System' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenLastCalledWith('reduce');
    expect(screen.getByRole('radio', { name: 'Reduce' })).toBeChecked();
    await user.click(screen.getByText('Full'));
    expect(onValueChange).toHaveBeenLastCalledWith('full');
  });
});

describe('Select and TextArea', () => {
  it('wires the label, placeholder option, error and hint', () => {
    render(
      <Select
        label="Type"
        placeholder="Choose one…"
        defaultValue=""
        hint="What kind of post is this?"
        error="Type is required."
        options={[
          { value: 'bug', label: 'Bug' },
          { value: 'game', label: 'Game request', disabled: true },
        ]}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Type' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Type is required. What kind of post is this?');
    expect(screen.getByRole('option', { name: 'Choose one…' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Game request' })).toBeDisabled();
    expect(select).toHaveValue('');
  });

  it('counts characters for uncontrolled textareas and marks optional fields', async () => {
    const user = userEvent.setup();
    render(<TextArea label="Comment" optional maxLength={500} showCount defaultValue="Hi" />);
    const area = screen.getByRole('textbox', { name: /Comment/ });
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(screen.getByText('2/500')).toBeInTheDocument();
    await user.type(area, '!!');
    expect(screen.getByText('4/500')).toBeInTheDocument();
    expect(area).toHaveAccessibleDescription('4 of 500 characters used');
  });
});

describe('Tabs', () => {
  it('keeps exactly one tab stop even when the selected id is unknown or disabled', () => {
    render(
      <Tabs
        label="Moderation"
        value="missing"
        items={[
          { id: 'posts', label: 'Posts', content: 'All posts', disabled: true },
          { id: 'comments', label: 'Comments', content: 'All comments' },
        ]}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs.filter((t) => t.tabIndex === 0)).toEqual([
      screen.getByRole('tab', { name: 'Comments' }),
    ]);
  });
});

describe('small primitives', () => {
  it('IconButton requires and exposes its label; decorative icon is hidden', () => {
    render(<IconButton label="Open menu" icon={<svg data-testid="icon" />} />);
    const btn = screen.getByRole('button', { name: 'Open menu' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('Spinner is silent unless labelled, then a status', () => {
    const { rerender, container } = render(<Spinner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Spinner label="Loading posts" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading posts');
  });

  it('Badge hides its decorative pulse; VisuallyHidden keeps text for screen readers', () => {
    const { container } = render(
      <>
        <Badge tone="velvet" pulse>
          Live
        </Badge>
        <VisuallyHidden as="p">Screen-reader note</VisuallyHidden>
      </>,
    );
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(container.querySelector('.animate-ping')).toHaveAttribute('aria-hidden', 'true');
    const note = screen.getByText('Screen-reader note');
    expect(note.tagName).toBe('P');
    expect(note).toHaveClass('sr-only');
  });
});
