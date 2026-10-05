// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';
import { Wordmark } from './Wordmark';

describe('404 page', () => {
  it('explains what happened and offers a way back', () => {
    const { container } = render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This scene got cut');
    expect(screen.getByRole('link', { name: 'Back to the lobby' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Browse games' })).toHaveAttribute('href', '/games');
    // The 4-0-4 card art is decoration only.
    const art = container.querySelector('svg')!.closest('[aria-hidden="true"]');
    expect(art).not.toBeNull();
  });
});

describe('Wordmark', () => {
  it('is an image named after the site unless decorative', () => {
    const { container, rerender } = render(<Wordmark size="sm" />);
    expect(screen.getByRole('img', { name: 'Game of Cards' })).toBeInTheDocument();
    rerender(<Wordmark size="lg" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses ids that are unique per instance (safe to render twice on a page)', () => {
    const { container } = render(
      <>
        <Wordmark size="sm" decorative />
        <Wordmark size="md" decorative />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
