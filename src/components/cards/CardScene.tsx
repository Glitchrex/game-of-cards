'use client';
import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useAnimate } from 'motion/react';
import { type CardCode } from '@/games/core/cards';
import { useReducedMotionPref } from '@/lib/motion';
import { PlayingCard } from './PlayingCard';
import { CARD_WIDTHS, type CardSize } from './sizes';
import { cardKeys, fanPose, fanSpill, rowLayout } from './layout';
import { describeScene, sceneHash, zoneName, type SceneLike, type SceneZoneLike } from './describe';

export interface CardSceneProps {
  /** A content-schema Scene (parsed or as written in a content file). */
  scene: SceneLike;
  size?: CardSize;
  /** Makes every card a button. */
  onCardClick?: (zoneId: string, index: number) => void;
  /** Raised card in interactive scenes. */
  selected?: { zoneId: string; index: number } | null;
  fourColor?: boolean;
  /** Show `scene.caption` under the table (default true). */
  showCaption?: boolean;
  className?: string;
  'data-testid'?: string;
}

type Mode = 'deal' | 'flip' | 'none';

const NOSCRIPT_DEAL_CSS = '[data-deal]{opacity:1!important}';

/**
 * Renders a lesson/example scene: labelled zones of cards in fan, row, stack,
 * cascade or grid layouts, with highlight glows and face-down cards. Cards deal
 * in from a deck position or flip face-up, and re-animate whenever the scene
 * changes. A visually hidden list describes every zone for screen readers.
 */
export function CardScene({
  scene,
  size = 'md',
  onCardClick,
  selected = null,
  fourColor,
  showCaption = true,
  className,
  'data-testid': testId,
}: CardSceneProps) {
  const hash = sceneHash(scene);
  const lines = describeScene(scene);
  const interactive = Boolean(onCardClick);
  return (
    <figure className={`m-0 w-full ${className ?? ''}`} data-testid={testId}>
      <SceneStage
        key={hash}
        scene={scene}
        size={size}
        onCardClick={onCardClick}
        selected={selected}
        fourColor={fourColor}
        interactive={interactive}
      />
      {(scene.animate ?? 'deal') === 'deal' && (
        // Deal scenes start hidden for the animation; without JavaScript, show them.
        <noscript>
          <style>{NOSCRIPT_DEAL_CSS}</style>
        </noscript>
      )}
      <ul className="sr-only" data-testid={testId ? `${testId}-description` : undefined}>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {showCaption && scene.caption && (
        <figcaption className="text-mist mt-3 text-center text-sm leading-snug">
          {scene.caption}
        </figcaption>
      )}
    </figure>
  );
}

interface StageProps {
  scene: SceneLike;
  size: CardSize;
  onCardClick?: (zoneId: string, index: number) => void;
  selected: { zoneId: string; index: number } | null;
  fourColor?: boolean;
  interactive: boolean;
}

function SceneStage({ scene, size, onCardClick, selected, fourColor, interactive }: StageProps) {
  const reduced = useReducedMotionPref();
  const mode: Mode = scene.animate ?? 'deal';
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [revealed, setRevealed] = useState(mode !== 'flip');

  // Deal: every card flies in from a deck just above the table's centre.
  useLayoutEffect(() => {
    if (mode !== 'deal') return;
    const stage = scope.current;
    if (!stage) return;
    const els = Array.from(stage.querySelectorAll<HTMLElement>('[data-deal]'));
    if (reduced) {
      els.forEach((el) => (el.style.opacity = '1'));
      return;
    }
    const box = stage.getBoundingClientRect();
    const ox = box.left + box.width / 2;
    const oy = box.top - 12;
    const controls = els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const dx = ox - (r.left + r.width / 2);
      const dy = oy - (r.top + r.height / 2);
      // Undo the slot's own rotation so the card really starts at the deck.
      const a = (Number(el.dataset.angle ?? 0) * Math.PI) / 180;
      const lx = dx * Math.cos(a) + dy * Math.sin(a);
      const ly = -dx * Math.sin(a) + dy * Math.cos(a);
      return animate(
        el,
        { x: [lx, 0], y: [ly, 0], rotate: [-16, 0], opacity: [0, 1] },
        { delay: 0.05 + i * 0.075, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      );
    });
    return () => controls.forEach((c) => c.complete());
  }, [mode, reduced, animate, scope]);

  // Flip: cards appear face-down, then turn over one by one.
  useEffect(() => {
    if (mode !== 'flip' || revealed) return;
    const id = window.setTimeout(() => setRevealed(true), reduced ? 0 : 280);
    return () => window.clearTimeout(id);
  }, [mode, revealed, reduced]);

  const total = scene.zones.length;
  const starts = scene.zones.map((_, zi) =>
    scene.zones.slice(0, zi).reduce((sum, z) => sum + z.cards.length, 0),
  );
  return (
    <div
      ref={scope}
      aria-hidden={interactive ? undefined : true}
      className="relative flex w-full flex-wrap items-end justify-center gap-x-6 gap-y-5"
    >
      {scene.zones.map((zone, zi) => {
        return (
          <SceneZoneView
            key={`${zone.id}-${zi}`}
            zone={zone}
            name={zoneName(zone, zi, total)}
            size={size}
            mode={mode}
            revealed={revealed}
            orderStart={starts[zi] ?? 0}
            onCardClick={onCardClick}
            selectedIndex={selected && selected.zoneId === zone.id ? selected.index : null}
            fourColor={fourColor}
            interactive={interactive}
          />
        );
      })}
    </div>
  );
}

interface ZoneViewProps {
  zone: SceneZoneLike;
  name: string;
  size: CardSize;
  mode: Mode;
  revealed: boolean;
  orderStart: number;
  onCardClick?: (zoneId: string, index: number) => void;
  selectedIndex: number | null;
  fourColor?: boolean;
  interactive: boolean;
}

function gridColumns(n: number): number {
  if (n <= 5) return n;
  if (n <= 8) return 4;
  if (n <= 12) return 6;
  return 7;
}

function SceneZoneView({
  zone,
  name,
  size,
  mode,
  revealed,
  orderStart,
  onCardClick,
  selectedIndex,
  fourColor,
  interactive,
}: ZoneViewProps) {
  const layout = zone.layout ?? 'row';
  const cards = zone.cards as CardCode[];
  const n = cards.length;
  const keys = cardKeys(cards);
  const hl = new Set(zone.highlight ?? []);
  const fd = new Set(zone.faceDown ?? []);
  const w = CARD_WIDTHS[size];

  const renderCard = (code: CardCode, i: number, angle = 0) => {
    const down = fd.has(i) || (mode === 'flip' && !revealed);
    return (
      <div
        data-deal={mode === 'deal' ? '' : undefined}
        data-angle={angle}
        style={mode === 'deal' ? { opacity: 0 } : undefined}
      >
        <PlayingCard
          code={code}
          size={size}
          faceDown={down}
          highlighted={hl.has(i)}
          fourColor={fourColor}
          decorative={!interactive}
          flipDelay={mode === 'flip' ? (orderStart + i) * 0.12 : 0}
          selected={interactive ? selectedIndex === i : undefined}
          onClick={onCardClick ? () => onCardClick(zone.id, i) : undefined}
          data-testid={`scene-card-${zone.id}-${i}`}
        />
      </div>
    );
  };

  const fan = layout === 'fan';
  const row =
    layout === 'row' || fan
      ? rowLayout(n, w, fan ? `calc(-0.48 * ${w})` : '8px', fan ? 0.3 : 0.34, fan ? fanSpill(n) : 0)
      : null;

  let body;
  if (layout === 'stack') {
    const visible = cards.slice(-6);
    const skip = n - visible.length;
    body = (
      <div className="relative" style={{ width: w, aspectRatio: '5 / 7' }}>
        {visible.map((code, j) => {
          const i = skip + j;
          const depth = visible.length - 1 - j;
          return (
            <div
              key={keys[i]}
              className="absolute inset-0"
              style={{ transform: `translate(${-depth * 2}px, ${-depth * 2}px)` }}
            >
              {renderCard(code, i)}
            </div>
          );
        })}
      </div>
    );
  } else if (layout === 'cascade') {
    body = (
      <div className="flex flex-col items-center">
        {cards.map((code, i) => (
          <div
            key={keys[i]}
            className="relative"
            style={{
              marginTop: i === 0 ? undefined : `calc(${w} * -1.4 * ${fd.has(i - 1) ? 0.86 : 0.74})`,
              zIndex: i,
            }}
          >
            {renderCard(code, i)}
          </div>
        ))}
      </div>
    );
  } else if (layout === 'grid') {
    const cols = gridColumns(n);
    body = (
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{ maxWidth: `calc(${cols} * ${w} + ${Math.max(cols - 1, 0)} * 0.5rem)` }}
      >
        {cards.map((code, i) => (
          <div key={keys[i]}>{renderCard(code, i)}</div>
        ))}
      </div>
    );
  } else if (row) {
    body = (
      <div
        className="flex items-end justify-center"
        style={{
          ...row.container,
          paddingTop: fan ? `calc(${w} * 0.12)` : undefined,
          paddingBottom: fan ? `calc(${w} * 0.14)` : undefined,
        }}
      >
        {cards.map((code, i) => {
          const pose = fan ? fanPose(i, n) : { rotate: 0, y: '0%' };
          const style: CSSProperties = {
            marginInlineStart: row.margin(i),
            zIndex: i,
            transformOrigin: '50% 100%',
            transform: fan ? `translateY(${pose.y}) rotate(${pose.rotate}deg)` : undefined,
          };
          return (
            <div key={keys[i]} className="relative shrink-0" style={style}>
              {renderCard(code, i, pose.rotate)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? name : undefined}
      className="flex max-w-full min-w-0 flex-col items-center"
      style={row ? { flex: `0 1 ${row.natural}` } : undefined}
      data-zone={zone.id}
    >
      {zone.label && (
        <p
          aria-hidden="true"
          className="text-mist mb-1.5 text-center text-[11px] font-bold tracking-[0.16em] uppercase"
        >
          {zone.label}
        </p>
      )}
      {body}
    </div>
  );
}
