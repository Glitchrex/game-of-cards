export const common = {
  close: 'Close',
  cancel: 'Cancel',
  loading: 'Loading…',
  optional: 'optional',
  copy: 'Copy',
  copied: 'Copied!',
  charCount: '{count}/{max}',
  charCountLabel: '{count} of {max} characters used',
  errors: {
    network: 'Couldn’t reach the server. Check your connection and try again.',
    generic: 'Something went wrong. Please try again.',
    fixFields: 'Please fix the highlighted fields and try again.',
  },
  validation: {
    required: '{field} is required.',
    tooShort: '{field} needs at least {min} characters.',
    tooLong: '{field} must be {max} characters or fewer.',
    email: 'Please enter a valid email address.',
  },
  stars: {
    option: '{n} out of 5 stars',
    rated: 'Rated {value} out of 5',
    unrated: 'Not rated yet',
  },
  toast: {
    region: 'Notifications',
  },
  notFound: {
    eyebrow: 'Error 404 · Reel missing',
    title: 'This scene got cut',
    body: 'The page you were looking for ended up on the editing-room floor. The show goes on, though — pick a seat and deal yourself back in.',
    home: 'Back to the lobby',
    games: 'Browse games',
  },
} as const;
