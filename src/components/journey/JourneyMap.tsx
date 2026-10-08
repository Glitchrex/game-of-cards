'use client';
/**
 * "Your learning journey": a winding gold-trimmed road across a felt map with one
 * stop per game. Stops are real links in journey order inside an ordered list (so
 * keyboard and screen-reader users get a plain list with statuses); the road, signs
 * and scenery are decorative.
 *
 * Three CSS-only layouts share one set of stops: a zig-zag down the page on phones,
 * a 4-wide serpentine on tablets and a 5-wide one on desktops. Each stop carries its
 * positions as CSS custom properties, so there is no layout flash and no JS
 * measuring.
 */
import Link from 'next/link';
import { type ComponentType, type CSSProperties, useMemo } from 'react';
import { cn } from '@/components/ui/cn';
import {
  ClubIcon,
  DiamondIcon,
  HeartIcon,
  SpadeIcon,
  TicketIcon,
  TrophyIcon,
  type IconProps,
} from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { type LearnStatus } from '@/store/progress';
import { isLearned, type GameSummary } from './journey-data';
import { journeyLayouts, MAP_WIDTH, type MapLayout, type MapPoint } from './layout';
import { StatusIcon, statusLabel } from './status';

export interface JourneyMapProps {
  /** Every game, in journey order. */
  games: readonly GameSummary[];
  /** Status per game (same order), or null until the stores have hydrated. */
  statuses: readonly LearnStatus[] | null;
  /** Index of the "Next up" stop, or -1 for none. */
  nextIndex: number;
  className?: string;
}

type LayoutKey = 'm' | 't' | 'd';

/** CSS custom properties that place an element at `p` in each of the three layouts. */
function placeVars(prefix: string, points: Record<LayoutKey, MapPoint>): CSSProperties {
  const vars: Record<string, string> = {};
  for (const key of ['m', 't', 'd'] as const) {
    vars[`--${prefix}x-${key}`] = `${(points[key].x / MAP_WIDTH) * 100}%`;
    vars[`--${prefix}y-${key}`] = `${points[key].y}px`;
  }
  return vars as CSSProperties;
}

const STOP_POSITION =
  'absolute left-(--jx-m) top-(--jy-m) md:left-(--jx-t) md:top-(--jy-t) lg:left-(--jx-d) lg:top-(--jy-d)';
const START_POSITION =
  'absolute left-(--sx-m) top-(--sy-m) md:left-(--sx-t) md:top-(--sy-t) lg:left-(--sx-d) lg:top-(--sy-d)';
const FINISH_POSITION =
  'absolute left-(--fx-m) top-(--fy-m) md:left-(--fx-t) md:top-(--fy-t) lg:left-(--fx-d) lg:top-(--fy-d)';

const CIRCLE: Record<LearnStatus | 'pending', string> = {
  pending: 'border border-mist/20 bg-felt-900/90 text-transparent',
  'not-started':
    'border-2 border-dashed border-mist/40 bg-felt-900/90 text-mist/80 group-hover/stop:border-mist/70',
  learning:
    'border-[3px] border-gold-300 bg-felt-950/90 text-gold-200 shadow-[0_0_0_4px_rgb(245_215_122/0.12),0_8px_18px_-8px_rgb(0_0_0/0.9)]',
  learned:
    'border-2 border-gold-100/80 bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400)_60%,var(--color-gold-500))] text-ink shadow-[0_8px_20px_-8px_rgb(236_193_83/0.8)]',
  mastered:
    'border-2 border-gold-100 bg-[radial-gradient(circle_at_35%_30%,var(--color-gold-100),var(--color-gold-300)_45%,var(--color-gold-600))] text-ink shadow-[0_0_0_5px_rgb(245_215_122/0.22),0_0_26px_2px_rgb(245_215_122/0.55)]',
};

const STATUS_TEXT: Record<LearnStatus, string> = {
  'not-started': 'text-mist',
  learning: 'text-gold-200',
  learned: 'text-gold-300',
  mastered: 'text-gold-100',
};

/** Faint suit glyphs printed on the felt, like an old gaming-table map. */
const SCENERY: {
  Icon: ComponentType<IconProps>;
  top: string;
  left: string;
  size: number;
  rotate: number;
}[] = [
  { Icon: SpadeIcon, top: '3%', left: '4%', size: 64, rotate: -14 },
  { Icon: HeartIcon, top: '14%', left: '86%', size: 56, rotate: 12 },
  { Icon: DiamondIcon, top: '29%', left: '44%', size: 48, rotate: -6 },
  { Icon: ClubIcon, top: '41%', left: '7%', size: 60, rotate: 18 },
  { Icon: SpadeIcon, top: '55%', left: '82%', size: 52, rotate: -20 },
  { Icon: HeartIcon, top: '68%', left: '38%', size: 44, rotate: 8 },
  { Icon: DiamondIcon, top: '80%', left: '10%', size: 58, rotate: -10 },
  { Icon: ClubIcon, top: '91%', left: '74%', size: 50, rotate: 14 },
];

interface RoadProps {
  layout: MapLayout;
  /** One flag per leg: light this stretch of road in gold. */
  lit: readonly boolean[];
  width: number;
  className?: string;
}

function Road({ layout, lit, width, className }: RoadProps) {
  const all = layout.legs.join(' ');
  const common = { vectorEffect: 'non-scaling-stroke' as const, d: all };
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${MAP_WIDTH} ${layout.height}`}
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full overflow-visible',
        className,
      )}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          {...common}
          transform="translate(0 6)"
          className="stroke-felt-950/70"
          strokeWidth={width + 12}
        />
        <path {...common} className="stroke-gold-700" strokeWidth={width + 6} />
        <path {...common} className="stroke-gold-500/60" strokeWidth={width + 2} />
        <path {...common} className="stroke-felt-950" strokeWidth={width} />
        <path {...common} className="stroke-gold-300/45" strokeWidth={2} strokeDasharray="10 12" />
        {layout.legs.map((d, i) =>
          lit[i] ? (
            <g key={i} data-lit="true">
              <path
                d={d}
                vectorEffect="non-scaling-stroke"
                className="stroke-gold-300/20"
                strokeWidth={width + 16}
              />
              <path
                d={d}
                vectorEffect="non-scaling-stroke"
                className="stroke-gold-300"
                strokeWidth={4}
              />
            </g>
          ) : null,
        )}
      </g>
    </svg>
  );
}

interface StopProps {
  game: GameSummary;
  index: number;
  status: LearnStatus | null;
  isNext: boolean;
}

function Stop({ game, index, status, isNext }: StopProps) {
  const n = index + 1;
  const label = status
    ? `${t(game.tier === 1 ? 'journey.map.nodePlayable' : 'journey.map.node', {
        n,
        name: game.name,
        status: statusLabel(status),
      })}${isNext ? `. ${t('journey.map.nodeNext')}` : ''}`
    : t('journey.map.nodePending', { n, name: game.name });
  return (
    <Link
      href={`/games/${game.slug}`}
      aria-label={label}
      data-testid={`journey-node-${game.slug}`}
      data-status={status ?? 'pending'}
      data-next={isNext || undefined}
      className="group/stop flex w-full flex-col items-center rounded-2xl text-center"
    >
      <span aria-hidden="true" className="relative">
        {isNext ? (
          <>
            <span className="border-gold-300/70 absolute -inset-2 animate-ping rounded-full border-2 [animation-duration:2.2s]" />
            <span className="bg-velvet-600 text-gold-100 border-gold-300/70 absolute -top-7 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[0.625rem] font-black tracking-[0.14em] whitespace-nowrap uppercase shadow-[0_4px_10px_-4px_rgb(0_0_0/0.8)]">
              {t('journey.map.nodeNext')}
            </span>
          </>
        ) : null}
        <span
          className={cn(
            'ease-snap relative flex size-14 items-center justify-center rounded-full transition-[transform,border-color,box-shadow] duration-200 group-hover/stop:scale-[1.07] md:size-16',
            CIRCLE[status ?? 'pending'],
          )}
        >
          {status ? <StatusIcon status={status} size={26} /> : null}
        </span>
        <span className="tabular bg-felt-950 text-gold-200 border-gold-300/60 absolute -top-1 -left-1 inline-flex size-6 items-center justify-center rounded-full border text-[0.6875rem] font-bold">
          {n}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="bg-felt-950/80 border-gold-300/15 group-hover/stop:border-gold-300/50 mt-2 flex max-w-full flex-col items-center gap-1 rounded-xl border px-2.5 py-1.5 shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)] backdrop-blur-[2px] transition-colors"
      >
        <span className="font-display text-cream group-hover/stop:text-gold-100 line-clamp-2 text-[0.9375rem] leading-tight font-bold text-balance">
          {game.name}
        </span>
        <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          {status ? (
            <span
              className={cn(
                'text-[0.6875rem] font-bold tracking-[0.08em] uppercase',
                STATUS_TEXT[status],
              )}
            >
              {statusLabel(status)}
            </span>
          ) : (
            <span className="bg-mist/15 h-3 w-14 animate-pulse rounded" />
          )}
          {game.tier === 1 ? (
            <span className="bg-velvet-600 text-cream border-velvet-400/60 inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[0.625rem] font-bold tracking-wide uppercase">
              <TicketIcon size={11} />
              {t('journey.map.play')}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

export function JourneyMap({ games, statuses, nextIndex, className }: JourneyMapProps) {
  const layouts = useMemo(() => journeyLayouts(games.length), [games.length]);
  const { phone, tablet, desktop } = layouts;

  // Leg 0 runs from the Start sign to stop 1; leg k ends at stop k+1 (or the trophy).
  const lit = useMemo(() => {
    const legs = games.length + 1;
    if (!statuses) return Array.from({ length: legs }, () => false);
    return Array.from({ length: legs }, (_, k) => {
      if (k === 0) return (statuses[0] ?? 'not-started') !== 'not-started';
      const before = statuses[k - 1];
      return before ? isLearned(before) : false;
    });
  }, [games.length, statuses]);

  const sizeVars = {
    '--jh-m': `${phone.height}px`,
    '--jh-t': `${tablet.height}px`,
    '--jh-d': `${desktop.height}px`,
    ...placeVars('s', { m: phone.start, t: tablet.start, d: desktop.start }),
    ...placeVars('f', { m: phone.finish, t: tablet.finish, d: desktop.finish }),
  } as CSSProperties;

  const allMastered =
    statuses !== null && statuses.length > 0 && statuses.every((s) => s === 'mastered');

  return (
    <div
      data-testid="journey-map"
      className={cn(
        'felt border-gold-300/45 relative overflow-hidden rounded-[28px] border-2 shadow-[inset_0_0_80px_rgb(0_0_0/0.55),0_30px_60px_-30px_rgb(0_0_0/0.95)]',
        className,
      )}
    >
      {/* brass inner frame, marquee bulbs and spotlight */}
      <span
        aria-hidden="true"
        className="border-gold-300/20 pointer-events-none absolute inset-3 rounded-[20px] border"
      />
      <span
        aria-hidden="true"
        className="marquee-bulbs pointer-events-none absolute inset-x-6 top-1 h-3 opacity-70"
      />
      <span
        aria-hidden="true"
        className="marquee-bulbs pointer-events-none absolute inset-x-6 bottom-1 h-3 opacity-70"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(255_246_217/0.12),transparent_70%)]"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        {SCENERY.map(({ Icon, top, left, size, rotate }, i) => (
          <Icon
            key={i}
            size={size}
            className="text-gold-200/[0.07] absolute"
            style={{ top, left, transform: `rotate(${rotate}deg)` }}
          />
        ))}
      </span>

      <div
        className="relative mx-2 h-(--jh-m) sm:mx-6 md:h-(--jh-t) lg:mx-8 lg:h-(--jh-d)"
        style={sizeVars}
      >
        <Road layout={phone} lit={lit} width={18} className="md:hidden" />
        <Road layout={tablet} lit={lit} width={22} className="hidden md:block lg:hidden" />
        <Road layout={desktop} lit={lit} width={24} className="hidden lg:block" />

        <span
          aria-hidden="true"
          className={cn(
            START_POSITION,
            'bg-gold-300 text-ink border-gold-100 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 px-3 py-1 text-xs font-black tracking-[0.2em] uppercase shadow-[0_6px_16px_-6px_rgb(0_0_0/0.9)]',
          )}
        >
          {t('journey.map.start')}
        </span>

        {/* role="list" keeps list semantics in Safari/VoiceOver despite list-style: none. */}
        <ol
          role="list"
          aria-label={t('journey.map.label')}
          className="absolute inset-0 m-0 list-none p-0"
        >
          {games.map((game, i) => (
            <li
              key={game.slug}
              className={cn(
                STOP_POSITION,
                'w-36 -translate-x-1/2 -translate-y-7 md:-translate-y-8',
              )}
              style={placeVars('j', {
                m: phone.stops[i] ?? phone.start,
                t: tablet.stops[i] ?? tablet.start,
                d: desktop.stops[i] ?? desktop.start,
              })}
            >
              <Stop game={game} index={i} status={statuses?.[i] ?? null} isNext={i === nextIndex} />
            </li>
          ))}
        </ol>

        <span
          aria-hidden="true"
          className={cn(
            FINISH_POSITION,
            'flex -translate-x-1/2 -translate-y-7 flex-col items-center gap-1.5 md:-translate-y-8',
          )}
        >
          <span
            className={cn(
              'flex size-14 items-center justify-center rounded-full border-2 md:size-16',
              allMastered
                ? 'border-gold-100 text-ink bg-[radial-gradient(circle_at_35%_30%,var(--color-gold-100),var(--color-gold-300)_45%,var(--color-gold-600))] shadow-[0_0_30px_4px_rgb(245_215_122/0.6)]'
                : 'border-gold-300/60 bg-felt-950/90 text-gold-300',
            )}
          >
            <TrophyIcon size={28} />
          </span>
          <span className="bg-felt-950/80 text-gold-200 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-black tracking-[0.2em] uppercase">
            {t('journey.map.finish')}
          </span>
        </span>
      </div>
    </div>
  );
}
