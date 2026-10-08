/**
 * Community Board icons (original artwork). Decorative unless a `title` is
 * passed. Post types and statuses each get a distinct silhouette so they are
 * never told apart by colour alone.
 */
import { type ReactNode } from 'react';
import { CardsIcon, type IconProps, MegaphoneIcon, SparkleIcon } from '@/components/ui/icons';
import { type PostStatus, type PostType } from '@/lib/api-client';

function Svg({ size = 20, title, children, ...rest }: IconProps & { children: ReactNode }) {
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true, focusable: 'false' } as const);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...a11y} {...rest}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Open: an empty spotlight ring with a dot — waiting for its moment. */
export function StatusOpenIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...stroke} cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </Svg>
  );
}

/** Planned: a calendar page with a marked day. */
export function StatusPlannedIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...stroke} x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path {...stroke} d="M3.5 10h17M8 3v4M16 3v4" />
      <rect x="13.5" y="13" width="4" height="4" rx="1" fill="currentColor" />
    </Svg>
  );
}

/** In progress: a film reel, mid-roll. */
export function StatusProgressIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...stroke} cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="7.6" r="1.9" fill="currentColor" />
      <circle cx="16.4" cy="12" r="1.9" fill="currentColor" />
      <circle cx="12" cy="16.4" r="1.9" fill="currentColor" />
      <circle cx="7.6" cy="12" r="1.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </Svg>
  );
}

/** Done: a solid seal with a tick. */
export function StatusDoneIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" />
      <path
        d="m7.6 12.4 3 3 5.8-6.2"
        stroke="var(--color-felt-900)"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StatusIcon({ status, ...p }: IconProps & { status: PostStatus }) {
  switch (status) {
    case 'planned':
      return <StatusPlannedIcon {...p} />;
    case 'in-progress':
      return <StatusProgressIcon {...p} />;
    case 'done':
      return <StatusDoneIcon {...p} />;
    default:
      return <StatusOpenIcon {...p} />;
  }
}

/** Bug report: a little beetle. */
export function BugIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M9 6.5a3 3 0 0 1 6 0" />
      <rect {...stroke} x="7" y="7.5" width="10" height="12.5" rx="5" />
      <path
        {...stroke}
        d="M12 11v9M3.5 9.5 7 11M20.5 9.5 17 11M3 14.5h4M17 14.5h4M4 19.5l3.3-2M20 19.5l-3.3-2"
      />
    </Svg>
  );
}

export function TypeIcon({ type, ...p }: IconProps & { type: PostType }) {
  switch (type) {
    case 'bug':
      return <BugIcon {...p} />;
    case 'game':
      return <CardsIcon {...p} />;
    case 'general':
      return <MegaphoneIcon {...p} />;
    default:
      return <SparkleIcon {...p} />;
  }
}

/** Upvote: a rounded marquee arrow. */
export function UpvoteIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 3.6c.5 0 .9.2 1.2.6l6.6 8.2c.6.8.1 1.9-.9 1.9H15.5v5.2c0 .7-.5 1.2-1.2 1.2H9.7c-.7 0-1.2-.5-1.2-1.2v-5.2H5.1c-1 0-1.5-1.1-.9-1.9l6.6-8.2c.3-.4.7-.6 1.2-.6Z"
      />
    </Svg>
  );
}

/** Comments: a speech bubble with three dots. */
export function CommentIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M5.5 4.5h13a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H11l-4.6 3.4c-.4.3-.9 0-.9-.4v-3H5.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"
      />
      <path {...stroke} strokeWidth={2.4} d="M8.5 10.8h.01M12 10.8h.01M15.5 10.8h.01" />
    </Svg>
  );
}

export function ArrowLeftIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  );
}

export function PencilIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path {...stroke} d="m13.5 6.5 4 4" />
    </Svg>
  );
}
