/**
 * Inline SVG icon set (original artwork, no icon font). Icons are decorative
 * (`aria-hidden`) unless a `title` is passed, in which case they become
 * `role="img"` with that accessible name.
 */
import { type ReactNode, type SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Pixel size (width = height). Default 20. */
  size?: number;
  /** Accessible name. Omit for decorative icons. */
  title?: string;
}

function Svg({
  size = 20,
  title,
  children,
  viewBox = '0 0 24 24',
  ...rest
}: IconProps & { children: ReactNode }) {
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true, focusable: 'false' } as const);
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" {...a11y} {...rest}>
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

export function SpadeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 2.5c-.4 0-.8.2-1 .5C8.6 6 4 9.1 4 13.1 4 15.8 6 17.6 8.3 17.6c1.2 0 2.2-.4 2.9-1.1-.2 1.9-.9 3.3-2.2 4.1-.4.3-.2.9.3.9h5.4c.5 0 .7-.6.3-.9-1.3-.8-2-2.2-2.2-4.1.7.7 1.7 1.1 2.9 1.1 2.3 0 4.3-1.8 4.3-4.5 0-4-4.6-7.1-7-10.1-.2-.3-.6-.5-1-.5Z"
      />
    </Svg>
  );
}

export function HeartIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 21c-.3 0-.6-.1-.8-.3C7 17.2 3 13.7 3 9.3 3 6.4 5.2 4 8 4c1.7 0 3.1.8 4 2.1C12.9 4.8 14.3 4 16 4c2.8 0 5 2.4 5 5.3 0 4.4-4 7.9-8.2 11.4-.2.2-.5.3-.8.3Z"
      />
    </Svg>
  );
}

export function DiamondIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 2.5c.3 0 .6.1.8.4l5.9 8.4c.3.4.3 1 0 1.4l-5.9 8.4c-.4.6-1.2.6-1.6 0l-5.9-8.4c-.3-.4-.3-1 0-1.4l5.9-8.4c.2-.3.5-.4.8-.4Z"
      />
    </Svg>
  );
}

export function ClubIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 2.8a4.3 4.3 0 0 0-3.6 6.7 4.3 4.3 0 1 0 2.5 6.6c-.2 2-.9 3.6-2.2 4.5-.4.3-.2.9.3.9h6c.5 0 .7-.6.3-.9-1.3-.9-2-2.5-2.2-4.5a4.3 4.3 0 1 0 2.5-6.6A4.3 4.3 0 0 0 12 2.8Z"
      />
    </Svg>
  );
}

export function GitHubMark(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" {...p}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 4.6 3 8.6 7.2 10 .5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.2 3.1.9.1-.7.4-1.2.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.3.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.5.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 1.9v2.9c0 .3.2.6.7.5 4.2-1.4 7.2-5.4 7.2-10C22.5 6.2 17.8 1.5 12 1.5Z"
      />
    </Svg>
  );
}

export function SpeakerOnIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity="0.15" />
      <path {...stroke} d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11" />
    </Svg>
  );
}

export function SpeakerOffIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity="0.15" />
      <path {...stroke} d="m16 9.5 5 5m0-5-5 5" />
    </Svg>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M10.3 3.6a1.7 1.7 0 0 1 3.4 0l.1.6a1.7 1.7 0 0 0 2.5 1l.5-.3a1.7 1.7 0 0 1 2.4 2.4l-.3.5a1.7 1.7 0 0 0 1 2.5l.6.1a1.7 1.7 0 0 1 0 3.4l-.6.1a1.7 1.7 0 0 0-1 2.5l.3.5a1.7 1.7 0 0 1-2.4 2.4l-.5-.3a1.7 1.7 0 0 0-2.5 1l-.1.6a1.7 1.7 0 0 1-3.4 0l-.1-.6a1.7 1.7 0 0 0-2.5-1l-.5.3a1.7 1.7 0 0 1-2.4-2.4l.3-.5a1.7 1.7 0 0 0-1-2.5l-.6-.1a1.7 1.7 0 0 1 0-3.4l.6-.1a1.7 1.7 0 0 0 1-2.5l-.3-.5a1.7 1.7 0 0 1 2.4-2.4l.5.3a1.7 1.7 0 0 0 2.5-1z"
      />
      <circle {...stroke} cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M4 7h16M4 12h16M4 17h10" />
    </Svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} strokeWidth={2.4} d="m5 12.5 4.2 4.2L19 7" />
    </Svg>
  );
}

export function CopyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...stroke} x="8.5" y="8.5" width="11" height="12" rx="2" />
      <path {...stroke} d="M15.5 8.5V6a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Svg>
  );
}

export function MailIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...stroke} x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path {...stroke} d="m4 7.5 8 5.5 8-5.5" />
    </Svg>
  );
}

export function ExternalIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"
      />
    </Svg>
  );
}

export function MegaphoneIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M4 10.2v3.6c0 .6.4 1 1 1h2.2l6.6 3.9c.5.3 1.2-.1 1.2-.7V6c0-.6-.7-1-1.2-.7L7.2 9.2H5c-.6 0-1 .4-1 1Z"
      />
      <path
        {...stroke}
        d="M7.5 15l1.3 4.3c.2.5.6.7 1.1.7h.6c.6 0 1-.5.9-1.1l-.7-3.4M18.5 9.5a3.6 3.6 0 0 1 0 5"
      />
    </Svg>
  );
}

export function StarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 2.8c.4 0 .7.2.9.6l2.3 4.7 5.2.8c.8.1 1.1 1.1.5 1.7l-3.8 3.7.9 5.2c.1.8-.7 1.4-1.4 1l-4.6-2.5-4.6 2.5c-.7.4-1.6-.2-1.4-1l.9-5.2-3.8-3.7c-.6-.6-.3-1.6.5-1.7l5.2-.8 2.3-4.7c.2-.4.5-.6.9-.6Z"
      />
    </Svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...stroke} cx="12" cy="12" r="9" />
      <path {...stroke} d="M12 11v5.5M12 7.6v.1" />
    </Svg>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M10.3 4.2 2.9 17.4A2 2 0 0 0 4.6 20.4h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"
      />
      <path {...stroke} d="M12 9.5v4.2M12 16.8v.1" />
    </Svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...stroke} cx="12" cy="12" r="9" />
      <path {...stroke} d="M12 7v5l3.2 2" />
    </Svg>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 2.5c.3 0 .5.2.6.5l1.4 4.6c.2.7.8 1.3 1.5 1.5l4.6 1.4c.6.2.6 1 0 1.2l-4.6 1.4c-.7.2-1.3.8-1.5 1.5L12.6 19c-.2.6-1 .6-1.2 0L10 14.6c-.2-.7-.8-1.3-1.5-1.5L3.9 11.7c-.6-.2-.6-1 0-1.2l4.6-1.4c.7-.2 1.3-.8 1.5-1.5L11.4 3c.1-.3.3-.5.6-.5Z"
      />
    </Svg>
  );
}

export function TicketIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5z"
      />
      <path {...stroke} strokeDasharray="1.5 2.5" d="M14.5 7v10" />
    </Svg>
  );
}

export function CardsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect
        {...stroke}
        x="3.5"
        y="5.5"
        width="10"
        height="14"
        rx="1.8"
        transform="rotate(-10 8.5 12.5)"
      />
      <rect
        {...stroke}
        x="10"
        y="4"
        width="10"
        height="14"
        rx="1.8"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </Svg>
  );
}

export function MapIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" />
      <path {...stroke} d="M9 4.5v13M15 6.5v13" />
    </Svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...stroke} cx="9" cy="8.5" r="3.3" />
      <path {...stroke} d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
      <path {...stroke} d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.8c1.8.6 3 2.2 3.5 4.7" />
    </Svg>
  );
}

export function BookIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"
      />
    </Svg>
  );
}

export function TrophyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5V17M8.5 20h7M9.5 17h5v3h-5z"
      />
    </Svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M4 11 12 4l8 7M6 9.5V20h4.5v-5h3v5H18V9.5" />
    </Svg>
  );
}

export function ShieldNoticeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...stroke} d="M12 3.2 5 5.8v5.6c0 4.4 3 7.8 7 9.4 4-1.6 7-5 7-9.4V5.8z" />
      <path {...stroke} d="m9 12 2.2 2.2L15.5 10" />
    </Svg>
  );
}
