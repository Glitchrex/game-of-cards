// @vitest-environment jsdom
/**
 * Server rendering + hydration of the Community Board and admin UI: relative
 * dates, persisted voter state and admin session checks must only kick in
 * after hydration, so the server HTML hydrates without mismatches.
 */
import { act } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { AdminApp } from '@/components/admin/AdminApp';
import { CommunityBoard } from './CommunityBoard';
import { PostCard } from './PostCard';
import { PostDetail } from './PostDetail';
import { PostGone } from './PostGone';
import { StatusPipeline } from './StatusPipeline';
import { makeComment, makePost } from './test-fixtures';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  // Nothing should need the network to render or hydrate; keep requests pending.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const post = makePost({
  title: 'Add Mendikot',
  body: 'Line one.\nLine two.',
  authorName: 'Asha',
  status: 'planned',
  upvotes: 3,
  commentCount: 1,
  createdAt: '2026-10-01T12:00:00.000Z',
});

const CASES: [string, ReactNode][] = [
  ['board', <CommunityBoard key="board" />],
  ['card', <PostCard key="card" post={post} onVoteChange={() => {}} highlight />],
  [
    'post page',
    <PostDetail
      key="detail"
      postId={post.id}
      initial={{ post, comments: [makeComment({ postId: post.id })] }}
    />,
  ],
  ['post 404', <PostGone key="gone" />],
  ['pipeline', <StatusPipeline key="pipeline" />],
  ['admin', <AdminApp key="admin" gameNames={{}} />],
];

describe('community + admin on the server', () => {
  it.each(CASES)('%s renders to HTML and hydrates cleanly', async (_name, element) => {
    const html = renderToString(element);
    expect(html.length).toBeGreaterThan(0);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: unknown[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });
    try {
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => errors.push(error),
        });
      });
      expect(errors).toEqual([]);
      act(() => root?.unmount());
    } finally {
      consoleError.mockRestore();
      container.remove();
    }
  });

  it('server-renders the post with a fixed date and a not-yet-active upvote button', () => {
    const html = renderToString(<PostDetail postId={post.id} initial={{ post, comments: [] }} />);
    expect(html).toContain('Add Mendikot');
    expect(html).toContain('Line one.\nLine two.');
    expect(html).toContain('1 Oct 2026');
    const container = document.createElement('div');
    container.innerHTML = html;
    const upvote = container.querySelector(`[data-testid="upvote-${post.id}"]`);
    expect(upvote).toHaveAttribute('disabled');
    expect(upvote).toHaveAttribute('aria-pressed', 'false');
  });
});
