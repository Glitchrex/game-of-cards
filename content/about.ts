// Edit this file to change the About section.
//
// This is the creator card shown on /contact. Everything below — especially
// the bio — is placeholder text meant to be replaced with your own words.
// (It's the only placeholder content on the whole site.)

export interface About {
  /** Display name on the creator card. */
  name: string;
  /** One-line role under the name. */
  role: string;
  /** Two letters shown inside the gold-ringed avatar. */
  avatarInitials: string;
  /** Short paragraphs, rendered in order. */
  bio: string[];
}

export const about: About = {
  name: 'Shikhar Pratap',
  role: 'Creator & developer of Game of Cards',
  avatarInitials: 'SP',
  // PLACEHOLDER BIO — replace these two paragraphs with your own story.
  bio: [
    'Hi! I built Game of Cards because every family get-together seemed to have a card game everyone else already knew — and nobody had the patience to explain the rules twice. So I made the patient teacher I always wanted: animated lessons, a coach that explains every move, and friendly bots that never sigh at you.',
    'When I’m not shuffling code, I’m probably losing a round of Teen Patti to a cousin. If you spot a rule that looks off, want a game added, or just want to say hello, send me a message — I read every one.',
  ],
};
