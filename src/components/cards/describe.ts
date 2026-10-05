/**
 * Plain-text descriptions of card scenes for screen readers, and a stable hash
 * used to re-run scene animations when the scene changes.
 */
import { type CardCode, cardName } from '@/games/core/cards';
import { type SceneSchema } from '@/lib/content/schema';
import { t } from '@/lib/i18n';
import { type z } from 'zod';

/** A scene as written in content files (layout/animate optional) or as parsed. */
export type SceneLike = z.input<typeof SceneSchema>;
export type SceneZoneLike = SceneLike['zones'][number];

/** Display name of a zone: its label, or "Cards" / "Group 2" when unlabeled. */
export function zoneName(zone: SceneZoneLike, index: number, total: number): string {
  if (zone.label) return zone.label;
  return total === 1 ? t('primer.cards.sceneCards') : t('primer.cards.sceneZone', { n: index + 1 });
}

/** "Ace of Spades", "King of Hearts (highlighted)", "face-down card". */
export function describeSceneCard(
  code: CardCode,
  opts: { faceDown?: boolean; highlighted?: boolean },
): string {
  const base = opts.faceDown ? t('primer.cards.sceneFaceDown') : cardName(code);
  return opts.highlighted ? `${base} (${t('primer.cards.highlighted')})` : base;
}

/**
 * One line per zone, e.g. "Your hand: Ace of Spades, King of Hearts (highlighted)".
 */
export function describeScene(scene: SceneLike): string[] {
  const total = scene.zones.length;
  return scene.zones.map((zone, zi) => {
    const hl = new Set(zone.highlight ?? []);
    const fd = new Set(zone.faceDown ?? []);
    const cards = zone.cards.map((c, i) =>
      describeSceneCard(c as CardCode, { faceDown: fd.has(i), highlighted: hl.has(i) }),
    );
    const list = cards.length ? cards.join(', ') : t('primer.cards.sceneEmpty');
    return `${zoneName(zone, zi, total)}: ${list}`;
  });
}

/** Small, stable string hash (djb2) of a scene. */
export function sceneHash(scene: SceneLike): string {
  const s = JSON.stringify(scene);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
