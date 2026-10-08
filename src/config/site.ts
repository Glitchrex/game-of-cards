/**
 * Single place for site identity and creator contact details.
 * Change the GitHub URL or email here and it updates everywhere.
 */
export const siteConfig = {
  name: 'Game of Cards',
  tagline: 'Learn every card game. The fun way.',
  description:
    'Game of Cards teaches card games to absolute beginners with animated lessons, coached example hands, friendly bots and pretend Jeet coins. No real money, ever.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  creator: {
    githubUrl: 'https://github.com/Glitchrex',
    githubHandle: 'Glitchrex',
    email: 'shikharpratap7@gmail.com',
  },
  currency: {
    name: 'Jeet',
    notice: 'Jeet is pretend money for learning. No real money, ever.',
  },
} as const;
