/** Card sizes. Widths are CSS lengths; height follows from the 5:7 aspect ratio. */
export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const CARD_WIDTHS: Record<CardSize, string> = {
  xs: '40px',
  sm: '56px',
  md: 'clamp(56px, 14vw, 84px)',
  lg: '96px',
  xl: '128px',
};

/** Height / width. */
export const CARD_RATIO = 7 / 5;

/** Corner radius as a CSS border-radius that stays circular on a 5:7 box (8% of width). */
export const CARD_RADIUS = '8% / 5.714%';
