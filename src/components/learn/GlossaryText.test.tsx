// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { renderToString } from 'react-dom/server';
import { GlossaryText } from './GlossaryText';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const glossary = [
  { term: 'trump', definition: 'The boss suit that beats every other suit.' },
  { term: 'pack', definition: 'To fold and give up the hand.' },
];

describe('GlossaryText', () => {
  it('turns [[term]] markup into buttons and leaves unknown terms as text', () => {
    render(
      <GlossaryText
        text={'Play a [[trump]] or [[packs|pack]].\n\nThe **[[gizmo]]** is not defined.'}
        glossary={glossary}
      />,
    );
    expect(screen.getByRole('button', { name: 'trump' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'packs' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'gizmo' })).not.toBeInTheDocument();
    expect(screen.getByText('gizmo').tagName).toBe('STRONG');
    // Two paragraphs from the blank line.
    expect(document.querySelectorAll('p')).toHaveLength(2);
  });

  it('describes each term with its definition for screen readers', () => {
    render(<GlossaryText text="A [[trump]] wins." glossary={glossary} />);
    expect(screen.getByRole('button', { name: 'trump' })).toHaveAccessibleDescription(
      'The boss suit that beats every other suit.',
    );
  });

  it('opens a definition popover on click and closes it with Escape', async () => {
    const user = userEvent.setup();
    render(<GlossaryText text="When you [[packs|pack]], you lose the pot." glossary={glossary} />);
    const term = screen.getByRole('button', { name: 'packs' });
    expect(term).toHaveAttribute('aria-expanded', 'false');
    await user.click(term);
    expect(term).toHaveAttribute('aria-expanded', 'true');
    const panelId = term.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId ?? '');
    expect(panel).toHaveTextContent('pack');
    expect(panel).toHaveTextContent('To fold and give up the hand.');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(term).toHaveAttribute('aria-expanded', 'false'));
    expect(term).toHaveFocus();
  });

  it('opens on keyboard focus', async () => {
    const user = userEvent.setup();
    render(<GlossaryText text="Lead a [[trump]]." glossary={glossary} />);
    await user.tab();
    const term = screen.getByRole('button', { name: 'trump' });
    expect(term).toHaveFocus();
    expect(term).toHaveAttribute('aria-expanded', 'true');
  });

  it('can render paragraphs as phrasing content and server-renders cleanly', () => {
    const html = renderToString(
      <GlossaryText inline text={'One [[trump]].\n\nTwo.'} glossary={glossary} />,
    );
    expect(html).not.toContain('<p');
    expect(html).toContain('trump');
    expect(html).toContain('Two.');
  });
});
