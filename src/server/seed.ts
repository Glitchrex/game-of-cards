/**
 * Sample Community Board content for `npm run db:seed`. Idempotent: does
 * nothing unless the posts table is empty.
 */
import type { PostStatus, PostType } from '@/lib/api-client';
import type { DbHandle } from './db/client';
import { createRepository } from './repo';

interface SamplePost {
  type: PostType;
  status: PostStatus;
  title: string;
  body: string;
  authorName: string | null;
  /** Hours before "now" the post was written. */
  hoursAgo: number;
  votes: number;
  comments: { body: string; authorName: string | null }[];
}

export const SAMPLE_POSTS: readonly SamplePost[] = [
  {
    type: 'feature',
    status: 'planned',
    title: 'A "show me the best move" button while playing',
    body: 'The coach in the practice hand is brilliant. Could we have the same hint button in real games against the bots? Even if it costs a few Jeet per hint, it would help me learn faster.',
    authorName: 'Ananya',
    hoursAgo: 150,
    votes: 7,
    comments: [
      { body: 'Yes! I keep forgetting when to double down in Blackjack.', authorName: 'Rohit' },
      {
        body: 'Maybe limit it to three hints per game so it still feels like a challenge.',
        authorName: null,
      },
    ],
  },
  {
    type: 'game',
    status: 'open',
    title: 'Please add Bluff (Cheat) — our family plays it every Diwali',
    body: 'Bluff is the loudest game at our family gatherings. It would be amazing to practise calling out lies against the bots before the next get-together.',
    authorName: 'Farhan',
    hoursAgo: 96,
    votes: 5,
    comments: [{ body: 'Seconded. My cousins never believe me anyway.', authorName: 'Ishita' }],
  },
  {
    type: 'bug',
    status: 'in-progress',
    title: 'Cards overlap on small phones in Indian Rummy',
    body: 'On my phone (375px wide) the last two cards in my hand sit on top of each other, so I cannot tap the one underneath. Rotating to landscape fixes it.',
    authorName: 'Priya',
    hoursAgo: 52,
    votes: 4,
    comments: [
      { body: 'Thanks for the clear report! A fix is on the way.', authorName: 'Game of Cards' },
    ],
  },
  {
    type: 'feature',
    status: 'done',
    title: 'Four-colour deck for people who mix up hearts and diamonds',
    body: 'I keep misreading red suits on a small screen. A setting with blue diamonds and green clubs would make a huge difference.',
    authorName: null,
    hoursAgo: 30,
    votes: 3,
    comments: [
      { body: 'This is now in Settings → Four-colour deck. Enjoy!', authorName: 'Game of Cards' },
      { body: 'Just tried it, so much easier to read. Thank you!', authorName: 'Meera' },
    ],
  },
  {
    type: 'general',
    status: 'open',
    title: 'The roasts after a loss are the best part',
    body: 'I lost three hands of Teen Patti in a row and laughed every single time. The tips after each roast actually helped me win the fourth one. Lovely work.',
    authorName: 'Vikram',
    hoursAgo: 6,
    votes: 2,
    comments: [],
  },
];

export interface SeedResult {
  seeded: boolean;
  posts: number;
  comments: number;
  votes: number;
}

const SEED_IP_HASH = 'seed';

export async function seedSampleData(
  handle: DbHandle,
  now: Date = new Date(),
): Promise<SeedResult> {
  let clock = now.getTime();
  const repo = createRepository(handle, { now: () => new Date(clock) });
  if ((await repo.countPosts()) > 0) {
    return { seeded: false, posts: 0, comments: 0, votes: 0 };
  }

  let comments = 0;
  let votes = 0;
  for (const sample of SAMPLE_POSTS) {
    clock = now.getTime() - sample.hoursAgo * 3_600_000;
    const post = await repo.createPost({
      type: sample.type,
      title: sample.title,
      body: sample.body,
      authorName: sample.authorName,
      authorEmail: null,
      ipHash: SEED_IP_HASH,
    });
    if (sample.status !== 'open') await repo.setPostStatus(post.id, sample.status);
    for (const [i, comment] of sample.comments.entries()) {
      clock += (i + 1) * 47 * 60_000;
      await repo.addComment(post.id, { ...comment, ipHash: SEED_IP_HASH });
      comments++;
    }
    for (let v = 0; v < sample.votes; v++) {
      clock += 5 * 60_000;
      await repo.toggleVote(post.id, `seed-voter-${String(v + 1).padStart(2, '0')}`, SEED_IP_HASH);
      votes++;
    }
  }
  return { seeded: true, posts: SAMPLE_POSTS.length, comments, votes };
}
