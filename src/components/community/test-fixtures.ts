/** Builders shared by the Community Board and admin component tests. */
import { type AdminPost, type Comment, type Post } from '@/lib/api-client';

let nextId = 100;

export function makePost(overrides: Partial<Post> = {}): Post {
  nextId += 1;
  return {
    id: nextId,
    type: 'feature',
    title: `Post number ${nextId}`,
    body: 'A description that is comfortably longer than ten characters.',
    authorName: null,
    status: 'open',
    upvotes: 0,
    commentCount: 0,
    createdAt: '2026-10-01T12:00:00.000Z',
    hasVoted: false,
    ...overrides,
  };
}

export function makeAdminPost(overrides: Partial<AdminPost> = {}): AdminPost {
  return { ...makePost(), authorEmail: null, ...overrides };
}

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  nextId += 1;
  return {
    id: nextId,
    postId: 1,
    body: 'A friendly comment.',
    authorName: null,
    createdAt: '2026-10-02T08:30:00.000Z',
    ...overrides,
  };
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

/** A promise you settle by hand — for asserting optimistic UI before the server answers. */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
