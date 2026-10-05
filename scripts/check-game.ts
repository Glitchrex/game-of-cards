/**
 * Validate a single game content file:  npx tsx scripts/check-game.ts <slug> [--tier1]
 * Prints every schema/consistency issue and a short summary of the content.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { validateGameContent, referencedTerms } from '../src/lib/content/schema';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npx tsx scripts/check-game.ts <slug> [--tier1]');
  process.exit(2);
}
const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'content/games', `${slug}.ts`);
const hasEngine =
  process.argv.includes('--tier1') || existsSync(path.join(root, 'src/games', slug, 'index.ts'));

const mod = (await import(pathToFileURL(file).href)) as { default: unknown };
const { content, issues } = validateGameContent(mod.default, { fileSlug: slug, hasEngine });
if (issues.length || !content) {
  for (const i of issues) console.error(`✗ ${i.message}`);
  process.exit(1);
}
const termsUsed = new Set<string>();
for (const s of content.lesson) referencedTerms(s.body).forEach((t) => termsUsed.add(t));
for (const s of content.example?.steps ?? [])
  referencedTerms(s.narration).forEach((t) => termsUsed.add(t));
console.info(
  `✓ ${content.name}: ${content.lesson.length} lesson steps, ` +
    `${content.example?.steps.length ?? 0} example steps ` +
    `(${content.example?.steps.filter((s) => s.decision).length ?? 0} decisions), ` +
    `${content.glossary.length} glossary terms (${termsUsed.size} linked), ` +
    `${content.quiz.length} quiz questions, tier ${hasEngine ? 1 : 2}.`,
);
