// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { CoinIcon, formatJeet, formatJeetDelta, JeetAmount } from './Jeet';

describe('formatJeet / formatJeetDelta', () => {
  it('uses digits with thousands separators and rounds', () => {
    expect(formatJeet(0)).toBe('0');
    expect(formatJeet(1000)).toBe('1,000');
    expect(formatJeet(1234567)).toBe('1,234,567');
    expect(formatJeet(99.6)).toBe('100');
  });

  it('signs deltas with + and a real minus sign', () => {
    expect(formatJeetDelta(500)).toBe('+500');
    expect(formatJeetDelta(-1200)).toBe('−1,200');
    expect(formatJeetDelta(-1200).charCodeAt(0)).toBe(0x2212);
    expect(formatJeetDelta(0)).toBe('0');
    expect(formatJeetDelta(-0.4)).toBe('0');
  });
});

describe('JeetAmount', () => {
  it('always reads "<amount> Jeet" to screen readers, with the unit visible on request', () => {
    const { rerender } = render(<JeetAmount amount={-120} signed />);
    const amount = screen.getByText('−120').parentElement!;
    expect(amount).toHaveTextContent('−120 Jeet');
    expect(screen.getByText('Jeet', { exact: false })).toHaveClass('sr-only');

    rerender(<JeetAmount amount={2500} showUnit />);
    expect(screen.getByText('2,500')).toBeInTheDocument();
    expect(screen.getByText('Jeet')).not.toHaveClass('sr-only');
  });
});

describe('CoinIcon', () => {
  it('is decorative by default and an image when titled, with unique gradient ids', () => {
    const { container } = render(
      <>
        <CoinIcon />
        <CoinIcon title="Jeet coin" />
      </>,
    );
    const [plain, titled] = Array.from(container.querySelectorAll('svg'));
    expect(plain).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: 'Jeet coin' })).toBe(titled);
    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
