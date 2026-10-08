'use client';
/**
 * Original SVG avatars for bot personas (docs/DECISIONS.md D-09): a friendly,
 * simple face on a coloured disc with one accessory drawn in the persona's accent
 * colour. Built from basic shapes on a 64 × 64 grid — no images, no likenesses.
 */
import { motion } from 'motion/react';
import { useId } from 'react';
import { type BotPersona } from '@/games/core/module';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { ThinkingDots } from './ThinkingDots';

export type AvatarAccessory = BotPersona['avatar']['accessory'];
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export const AVATAR_ACCESSORIES: readonly AvatarAccessory[] = [
  'turban',
  'cap',
  'shades',
  'bow',
  'crown',
  'headphones',
  'monocle',
  'flower',
  'beret',
  'none',
];

const SIZES: Record<Exclude<AvatarSize, number>, number> = {
  xs: 32,
  sm: 40,
  md: 56,
  lg: 80,
  xl: 112,
};

const HAIR = '#3a2417';
const INK = '#17161b';
const IVORY = '#fbf6ea';
const GOLD = '#f5d77a';
const GOLD_DARK = '#8a6312';

/** Mix a #rgb / #rrggbb colour towards black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return hex;
  const raw =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1];
  const n = Number.parseInt(raw, 16);
  const target = amount < 0 ? 0 : 255;
  const a = Math.min(1, Math.abs(amount));
  const mix = (c: number) => Math.round(c + (target - c) * a);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => mix(c).toString(16).padStart(2, '0'))
    .join('')}`;
}

const SHORT_HAIR =
  'M18.6 29 C18 19.5 24 15 32 15 C40 15 46 19.5 45.4 29 C44 25 41.5 22.5 38 21.8 C35 23.2 29 23.2 26 21.8 C22.5 22.5 20 25 18.6 29 Z';
const LONG_HAIR_BACK =
  'M17 43 C13.8 26 20 14.5 32 14.5 C44 14.5 50.2 26 47 43 C45.2 39 44.4 34.5 44 30 L20 30 C19.6 34.5 18.8 39 17 43 Z';

function hairStyle(accessory: AvatarAccessory): 'short' | 'long' | 'none' {
  if (accessory === 'turban') return 'none';
  if (accessory === 'bow' || accessory === 'flower') return 'long';
  return 'short';
}

function Accessory({ kind, accent }: { kind: AvatarAccessory; accent: string }) {
  const dark = shade(accent, -0.3);
  switch (kind) {
    case 'turban':
      return (
        <g data-part="turban">
          <path
            d="M17.8 28.5 C16.5 17 23 11 32 11 C41 11 47.5 17 46.2 28.5 C43.5 24.5 38.5 22.2 32 22.2 C25.5 22.2 20.5 24.5 17.8 28.5 Z"
            fill={accent}
          />
          <path
            d="M19.5 23.5 C24 17 36 14.5 44.5 20.5 M19 27 C25 20.5 38 19.5 45 24.5"
            fill="none"
            stroke={dark}
            strokeWidth={1.3}
            strokeLinecap="round"
          />
          <path
            d="M32 17.6 C30.8 14 32.5 11.5 35.5 10.5"
            fill="none"
            stroke={IVORY}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <circle cx={32} cy={20} r={2.4} fill={GOLD} stroke={GOLD_DARK} strokeWidth={0.7} />
        </g>
      );
    case 'cap':
      return (
        <g data-part="cap">
          <path
            d="M19.2 25.5 C19.2 16.5 25 12.5 32 12.5 C39 12.5 44.8 16.5 44.8 25.5 Z"
            fill={accent}
          />
          <path d="M32 12.8 L32 25.4" stroke={shade(accent, -0.2)} strokeWidth={0.8} />
          <path
            d="M30 23.8 C37 22.4 45.5 22.6 50.5 25.2 C46 27.4 37.5 27 30 26.2 Z"
            fill={shade(accent, -0.25)}
          />
          <circle cx={32} cy={12.8} r={1.4} fill={dark} />
        </g>
      );
    case 'shades':
      return (
        <g data-part="shades">
          <rect
            x={22.4}
            y={25.8}
            width={8.8}
            height={6}
            rx={2.4}
            fill={INK}
            stroke={accent}
            strokeWidth={1.1}
          />
          <rect
            x={32.8}
            y={25.8}
            width={8.8}
            height={6}
            rx={2.4}
            fill={INK}
            stroke={accent}
            strokeWidth={1.1}
          />
          <path
            d="M31.2 28 Q32 27.2 32.8 28 M22.4 27.6 L19.2 28.6 M41.6 27.6 L44.8 28.6"
            fill="none"
            stroke={accent}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
          <path
            d="M24.2 30.6 L26.6 27.4 M34.6 30.6 L37 27.4"
            stroke="#ffffff"
            strokeOpacity={0.6}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        </g>
      );
    case 'bow':
      return (
        <g data-part="bow">
          <path d="M41 17 L35.8 13.2 L36.2 21 Z M41 17 L46.2 13.2 L45.8 21 Z" fill={accent} />
          <circle cx={41} cy={17} r={2} fill={shade(accent, -0.25)} />
        </g>
      );
    case 'crown':
      return (
        <g data-part="crown">
          <path
            d="M22.5 21 L22 12.5 L27 16.5 L32 10.5 L37 16.5 L42 12.5 L41.5 21 Z"
            fill={accent}
            stroke={shade(accent, -0.35)}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          <rect x={22.4} y={18.6} width={19.2} height={2.8} rx={1} fill={shade(accent, -0.2)} />
          <circle cx={32} cy={20} r={1.3} fill="#c22f47" />
          <circle cx={26.8} cy={20} r={0.9} fill={IVORY} />
          <circle cx={37.2} cy={20} r={0.9} fill={IVORY} />
          <circle cx={22} cy={12.5} r={1.1} fill={IVORY} />
          <circle cx={32} cy={10.5} r={1.1} fill={IVORY} />
          <circle cx={42} cy={12.5} r={1.1} fill={IVORY} />
        </g>
      );
    case 'headphones':
      return (
        <g data-part="headphones">
          <path
            d="M18 29 C18 13.5 46 13.5 46 29"
            fill="none"
            stroke={accent}
            strokeWidth={2.8}
            strokeLinecap="round"
          />
          <rect x={14.6} y={25} width={6.4} height={10} rx={3} fill={accent} />
          <rect x={43} y={25} width={6.4} height={10} rx={3} fill={accent} />
          <rect x={16.6} y={27} width={2.6} height={6} rx={1.2} fill={shade(accent, -0.35)} />
          <rect x={44.8} y={27} width={2.6} height={6} rx={1.2} fill={shade(accent, -0.35)} />
        </g>
      );
    case 'monocle':
      return (
        <g data-part="monocle">
          <path
            d="M27.5 33.2 C29.5 31.8 31 32.4 32 33.2 C33 32.4 34.5 31.8 36.5 33.2 C34.5 34.2 33 34 32 33.6 C31 34 29.5 34.2 27.5 33.2 Z"
            fill={HAIR}
          />
          <circle
            cx={36.8}
            cy={28.9}
            r={4.3}
            fill="#ffffff"
            fillOpacity={0.14}
            stroke={accent}
            strokeWidth={1.4}
          />
          <path
            d="M41 31.6 C43.6 36 42 40.5 38.5 45"
            fill="none"
            stroke={accent}
            strokeWidth={0.9}
            strokeDasharray="1.2 1.2"
          />
        </g>
      );
    case 'flower': {
      const cx = 20.5;
      const cy = 20.5;
      return (
        <g data-part="flower">
          {[0, 1, 2, 3, 4].map((k) => {
            const a = (k * 72 - 90) * (Math.PI / 180);
            return (
              <circle
                key={k}
                cx={Math.round((cx + Math.cos(a) * 2.6) * 100) / 100}
                cy={Math.round((cy + Math.sin(a) * 2.6) * 100) / 100}
                r={2.5}
                fill={accent}
              />
            );
          })}
          <circle cx={cx} cy={cy} r={1.7} fill={GOLD} />
        </g>
      );
    }
    case 'beret':
      return (
        <g data-part="beret">
          <path
            d="M17.5 21.5 C17 15 24 11 32.5 11 C41 11 47.5 14.5 47 19 C46.5 21.5 42 22 38 21.6 C31 21 23 21.5 17.5 21.5 Z"
            fill={accent}
          />
          <path
            d="M18.2 21.2 C25 20.2 38 20.4 46 20.6"
            fill="none"
            stroke={dark}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
          <path d="M33 11.2 L33.6 8.6" stroke={dark} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      );
    case 'none':
      return null;
  }
}

function Figure({ persona }: { persona: BotPersona }) {
  const { skin, accessory, accent } = persona.avatar;
  const hair = hairStyle(accessory);
  const coversEyes = accessory === 'shades';
  return (
    <>
      {/* Shoulders, collar, neck */}
      <path
        d="M7 66 C7 52.5 17.5 45.5 32 45.5 C46.5 45.5 57 52.5 57 66 Z"
        fill={shade(accent, -0.45)}
      />
      <path
        d="M25.5 46.2 L32 53.5 L38.5 46.2 L35.6 45.4 L32 49.6 L28.4 45.4 Z"
        fill={IVORY}
        fillOpacity={0.92}
      />
      <path d="M28 38 L36 38 L36.6 47 L27.4 47 Z" fill={shade(skin, -0.12)} />
      {hair === 'long' ? <path d={LONG_HAIR_BACK} fill={HAIR} /> : null}
      {/* Ears + head */}
      <circle cx={19.2} cy={30} r={2.8} fill={skin} />
      <circle cx={44.8} cy={30} r={2.8} fill={skin} />
      <circle cx={19.4} cy={30} r={1.2} fill={shade(skin, -0.18)} />
      <circle cx={44.6} cy={30} r={1.2} fill={shade(skin, -0.18)} />
      <circle cx={32} cy={29} r={13} fill={skin} />
      {hair !== 'none' ? <path d={SHORT_HAIR} fill={HAIR} /> : null}
      {/* Face */}
      <path
        d="M24.8 25.4 Q27.2 24.2 29.4 25.2 M34.6 25.2 Q36.8 24.2 39.2 25.4"
        fill="none"
        stroke={HAIR}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {coversEyes ? null : (
        <g>
          <ellipse cx={27.2} cy={28.8} rx={1.55} ry={1.85} fill={INK} />
          <ellipse cx={36.8} cy={28.8} rx={1.55} ry={1.85} fill={INK} />
          <circle cx={27.7} cy={28.2} r={0.5} fill="#ffffff" />
          <circle cx={37.3} cy={28.2} r={0.5} fill="#ffffff" />
        </g>
      )}
      <path
        d="M32.2 30 Q31 32.6 32.8 32.9"
        fill="none"
        stroke={shade(skin, -0.3)}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <circle cx={24.6} cy={32.6} r={2.3} fill="#e86a6a" fillOpacity={0.28} />
      <circle cx={39.4} cy={32.6} r={2.3} fill="#e86a6a" fillOpacity={0.28} />
      <path
        d="M28 34.8 Q32 38.6 36 34.8"
        fill="none"
        stroke="#5a2a1e"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Accessory kind={accessory} accent={accent} />
    </>
  );
}

export interface BotAvatarProps {
  persona: BotPersona;
  size?: AvatarSize;
  /** Shows a pulsing gold ring and thinking dots. */
  thinking?: boolean;
  /** Show the dots bubble while thinking (default true; Seat shows its own). */
  showDots?: boolean;
  /** Hide from assistive tech when a parent already names the persona. */
  decorative?: boolean;
  className?: string;
}

/** A persona's avatar (role="img", named after the persona). */
export function BotAvatar({
  persona,
  size = 'md',
  thinking = false,
  showDots = true,
  decorative = false,
  className,
}: BotAvatarProps) {
  const px = typeof size === 'number' ? size : SIZES[size];
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reduce = useReducedMotionPref();
  const { bg, accessory } = persona.avatar;
  const label = thinking ? t('play.avatar.thinking', { name: persona.name }) : persona.name;
  const clipId = `${uid}-clip`;
  const bgId = `${uid}-bg`;

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: px, height: px }}
      data-testid="bot-avatar"
      data-accessory={accessory}
      data-thinking={thinking || undefined}
    >
      {thinking ? (
        <motion.span
          aria-hidden="true"
          className="border-gold-300 absolute -inset-1 rounded-full border-2 shadow-[0_0_14px_rgb(245_215_122/0.6)]"
          animate={reduce ? { opacity: 1 } : { opacity: [0.35, 1, 0.35], scale: [1, 1.06, 1] }}
          transition={reduce ? { duration: 0 } : { duration: 1.4, repeat: Infinity }}
        />
      ) : null}
      <svg
        viewBox="0 0 64 64"
        width={px}
        height={px}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
        focusable="false"
        className="relative block rounded-full"
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={32} cy={32} r={32} />
          </clipPath>
          <radialGradient id={bgId} cx="0.35" cy="0.25" r="0.9">
            <stop offset="0" stopColor={shade(bg, 0.22)} />
            <stop offset="1" stopColor={shade(bg, -0.3)} />
          </radialGradient>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect width={64} height={64} fill={`url(#${bgId})`} />
          <Figure persona={persona} />
        </g>
        <circle
          cx={32}
          cy={32}
          r={31.2}
          fill="none"
          stroke={GOLD}
          strokeOpacity={0.55}
          strokeWidth={1.6}
        />
      </svg>
      {thinking && showDots ? (
        <span className="border-gold-300/50 bg-felt-950/90 absolute -top-1.5 -right-2.5 inline-flex rounded-full border px-1.5 py-1 shadow-[0_4px_10px_rgb(0_0_0/0.5)]">
          <ThinkingDots size="sm" />
        </span>
      ) : null}
    </span>
  );
}
