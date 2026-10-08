/** /admin is never indexed and gets game names resolved on the server. */
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { AdminApp, type AdminAppProps } from '@/components/admin/AdminApp';

vi.mock('@/lib/content/catalog', () => ({
  getAllGames: () => [
    { slug: 'blackjack', name: 'Blackjack' },
    { slug: 'teen-patti', name: 'Teen Patti' },
  ],
}));

const { default: AdminPage, metadata } = await import('./page');

function findElement(node: ReactNode, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === type) return node;
  return findElement((node.props as { children?: ReactNode }).children, type);
}

describe('/admin', () => {
  it('asks search engines not to index or follow it', () => {
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    });
  });

  it('passes slug → name pairs to the client view (not the whole catalog)', () => {
    const app = findElement(AdminPage(), AdminApp) as ReactElement<AdminAppProps> | null;
    expect(app).not.toBeNull();
    expect(app?.props.gameNames).toEqual({ blackjack: 'Blackjack', 'teen-patti': 'Teen Patti' });
  });
});
