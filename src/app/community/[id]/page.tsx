import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { excerpt } from '@/components/community/format';
import { PostDetail, type PostWithComments } from '@/components/community/PostDetail';
import { t } from '@/lib/i18n';
import { getPost } from '@/server/repo';

// Posts, votes and comments change all the time: render on every request.
export const dynamic = 'force-dynamic';

interface PostPageProps {
  params: Promise<{ id: string }>;
}

const MAX_DB_ID = 2_147_483_647;

/** Same rule as the API: a positive 32-bit integer, no leading zeros. */
function parsePostId(raw: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_DB_ID ? id : null;
}

type Lookup = { status: 'found'; data: PostWithComments } | { status: 'missing' | 'unavailable' };

/**
 * Props of a client component are serialised into the page's HTML, so copy
 * only the public fields — an extra column from the repository (an author
 * email, an IP hash) can never reach the browser through this page.
 */
function publicCopy({ post, comments }: PostWithComments): PostWithComments {
  return {
    post: {
      id: post.id,
      type: post.type,
      title: post.title,
      body: post.body,
      authorName: post.authorName,
      status: post.status,
      upvotes: post.upvotes,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
    },
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      body: c.body,
      authorName: c.authorName,
      createdAt: c.createdAt,
    })),
  };
}

/** One database read per request, shared by generateMetadata and the page. */
const lookupPost = cache(async (id: number): Promise<Lookup> => {
  try {
    const data = await getPost(id);
    return data ? { status: 'found', data: publicCopy(data) } : { status: 'missing' };
  } catch (err) {
    console.error('[community] could not load post', id, err);
    return { status: 'unavailable' };
  }
});

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const id = parsePostId((await params).id);
  const found = id === null ? null : await lookupPost(id);
  if (!found || found.status !== 'found') {
    return {
      title: t('community.meta.postTitle'),
      description: t('community.meta.postDescription'),
      robots: { index: false },
    };
  }
  const { post } = found.data;
  const description = excerpt(post.body, 155);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/community/${post.id}` },
    openGraph: { title: post.title, description, url: `/community/${post.id}`, type: 'article' },
  };
}

export default async function CommunityPostPage({ params }: PostPageProps) {
  const id = parsePostId((await params).id);
  if (id === null) notFound();
  const found = await lookupPost(id);
  if (found.status === 'missing') notFound();
  // If the database hiccuped, the browser retries through the API (with a Retry button).
  return <PostDetail postId={id} initial={found.status === 'found' ? found.data : null} />;
}
