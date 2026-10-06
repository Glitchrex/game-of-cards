/**
 * Server side of /community and /community/[id]: metadata, real 404s, and
 * only public post fields handed to the client component.
 */
import { isValidElement, type ReactElement } from 'react';
import type { PostDetailProps } from '@/components/community/PostDetail';
import { makeComment, makePost } from '@/components/community/test-fixtures';

const repo = vi.hoisted(() => ({ getPost: vi.fn() }));
vi.mock('@/server/repo', () => repo);

const NOT_FOUND = 'NEXT_NOT_FOUND_FOR_TEST';
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

const { metadata: boardMetadata } = await import('./page');
const { default: PostPage, generateMetadata, dynamic } = await import('./[id]/page');

const params = (id: string) => Promise.resolve({ id });

beforeEach(() => {
  repo.getPost.mockReset();
});

describe('/community', () => {
  it('is titled "Community Board" with a canonical URL', () => {
    expect(boardMetadata.title).toBe('Community Board');
    expect(boardMetadata.alternates?.canonical).toBe('/community');
    expect(boardMetadata.robots).toBeUndefined();
  });
});

describe('/community/[id]', () => {
  it('renders on every request', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it.each(['abc', '0', '007', '-1', '1.5', '99999999999'])(
    '404s for the malformed id %s without touching the database',
    async (id) => {
      await expect(PostPage({ params: params(id) })).rejects.toThrow(NOT_FOUND);
      expect(repo.getPost).not.toHaveBeenCalled();
    },
  );

  it('404s for an unknown post', async () => {
    repo.getPost.mockResolvedValue(null);
    await expect(PostPage({ params: params('4242') })).rejects.toThrow(NOT_FOUND);
    expect(repo.getPost).toHaveBeenCalledWith(4242);
    const meta = await generateMetadata({ params: params('4242') });
    expect(meta.robots).toEqual({ index: false });
  });

  it('hands only public fields to the browser and titles the page after the post', async () => {
    const post = makePost({ id: 7, title: 'Add Mendikot', body: 'Please.\nIt is great fun.' });
    const comment = makeComment({ postId: 7, authorName: 'Meera' });
    // Even if a future repository change returned private columns…
    repo.getPost.mockResolvedValue({
      post: { ...post, authorEmail: 'secret@example.com', ipHash: 'abc123' },
      comments: [{ ...comment, ipHash: 'def456' }],
    });

    const element = (await PostPage({ params: params('7') })) as ReactElement<PostDetailProps>;
    expect(isValidElement(element)).toBe(true);
    expect(element.props.postId).toBe(7);
    const serialized = JSON.stringify(element.props);
    expect(serialized).not.toContain('secret@example.com');
    expect(serialized).not.toContain('ipHash');
    const { hasVoted: _hasVoted, ...publicPost } = post;
    expect(element.props.initial).toEqual({ post: publicPost, comments: [comment] });

    const meta = await generateMetadata({ params: params('7') });
    expect(meta.title).toBe('Add Mendikot');
    expect(meta.description).toBe('Please. It is great fun.');
    expect(meta.alternates?.canonical).toBe('/community/7');
    expect(meta.robots).toBeUndefined();
  });

  it('lets the browser retry when the database read fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      repo.getPost.mockRejectedValue(new Error('database is locked'));
      const element = (await PostPage({ params: params('8') })) as ReactElement<PostDetailProps>;
      expect(element.props).toEqual({ postId: 8, initial: null });
    } finally {
      error.mockRestore();
    }
  });
});
