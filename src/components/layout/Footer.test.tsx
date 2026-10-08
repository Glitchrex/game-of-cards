// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { siteConfig } from '@/config/site';
import { Footer } from './Footer';

describe('Footer', () => {
  it('shows the exact pretend-money notice', () => {
    render(<Footer />);
    expect(screen.getByTestId('pretend-money-notice').textContent).toBe(
      'Jeet is pretend money for learning. No real money, ever.',
    );
  });

  it('has link groups, a safe external GitHub link, the email and copyright', () => {
    render(<Footer />);
    const nav = screen.getByRole('navigation', { name: 'Footer' });
    for (const [name, href] of [
      ['Games', '/games'],
      ['Card basics', '/basics'],
      ['Journey', '/journey'],
      ['Stats & awards', '/stats'],
      ['Board', '/community'],
      ['Contact', '/contact'],
    ]) {
      expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    const gh = screen.getByRole('link', { name: 'GitHub (opens in a new tab)' });
    expect(gh).toHaveAttribute('href', siteConfig.creator.githubUrl);
    expect(gh).toHaveAttribute('target', '_blank');
    expect(gh).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      screen.getByRole('link', { name: new RegExp(siteConfig.creator.email) }),
    ).toHaveAttribute('href', `mailto:${siteConfig.creator.email}`);
    expect(screen.getByText(new RegExp(`© \\d{4} ${siteConfig.name}`))).toBeInTheDocument();
  });
});
