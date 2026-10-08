/**
 * Validates every content/games/<slug>.ts file. Exits non-zero on any problem,
 * which makes `npm run build` (via prebuild) fail.
 */
import { rawGameContent } from '../content/games/index';
import { ENGINE_SLUGS, TIER1_SLUGS } from '../src/games/slugs.generated';
import { validateGameContent } from '../src/lib/content/schema';
import { titles, roasts } from '../content/titles';

let failures = 0;
const tier1 = new Set(TIER1_SLUGS);
for (const [slug, raw] of Object.entries(rawGameContent)) {
  const { issues } = validateGameContent(raw, { fileSlug: slug, hasEngine: tier1.has(slug) });
  for (const i of issues) {
    failures++;
    console.error(`✗ [${i.slug}] ${i.message}`);
  }
}
for (const slug of tier1) {
  if (!rawGameContent[slug]) {
    failures++;
    console.error(`✗ [${slug}] has an engine module but no content/games/${slug}.ts`);
  }
}
for (const slug of ENGINE_SLUGS) {
  if (!tier1.has(slug)) {
    failures++;
    console.error(
      `✗ [${slug}] has src/games/${slug}/engine.ts but no index.ts (GameModule) — finish wiring it up`,
    );
  }
}
if (titles.length < 48) {
  failures++;
  console.error(`✗ content/titles.ts has ${titles.length} win titles (need ≥ 48)`);
}
if (roasts.length < 48) {
  failures++;
  console.error(`✗ content/titles.ts has ${roasts.length} roasts (need ≥ 48)`);
}
if (failures) {
  console.error(`\nContent validation failed with ${failures} problem(s).`);
  process.exit(1);
}
console.info(
  `✓ ${Object.keys(rawGameContent).length} game content files valid (${tier1.size} Tier 1), ` +
    `${titles.length} titles, ${roasts.length} roasts.`,
);
