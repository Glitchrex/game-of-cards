// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Stars } from './Stars';

function Rating({ onChange }: { onChange: (v: number) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <>
      <button type="button">Before</button>
      <Stars
        label="Rate this lesson"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    </>
  );
}

describe('Stars (input)', () => {
  it('is a labelled radiogroup with five radios and one tab stop', () => {
    render(<Rating onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Rate this lesson' });
    const radios = screen.getAllByRole('radio');
    expect(group).toContainElement(radios[0]!);
    expect(radios).toHaveLength(5);
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole('radio', { name: '3 out of 5 stars' })).toBeInTheDocument();
  });

  it('selects with arrow keys, Home/End and wraps around', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    const first = screen.getByRole('radio', { name: '1 out of 5 stars' });
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(2);
    const two = screen.getByRole('radio', { name: '2 out of 5 stars' });
    expect(two).toHaveFocus();
    expect(two).toHaveAttribute('aria-checked', 'true');
    expect(two.tabIndex).toBe(0);

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith(5);
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(1);
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(5);
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith(1);
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByRole('radio', { name: '2 out of 5 stars' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('selects with Space and with a click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: '4 out of 5 stars' }));
    expect(onChange).toHaveBeenLastCalledWith(4);
    await user.keyboard('{ArrowLeft}');
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(3);
  });
});

describe('Stars (read-only)', () => {
  it('renders an image with a text alternative and no radios', () => {
    render(<Stars readOnly value={4.26} />);
    expect(screen.getByRole('img', { name: 'Rated 4.3 out of 5' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
