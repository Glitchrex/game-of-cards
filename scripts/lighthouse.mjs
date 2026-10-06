#!/usr/bin/env node
/**
 * Lighthouse audit of a running production server.
 *
 *   npm run build && npm start   # in another terminal
 *   npm run lighthouse
 *
 * Env:
 *   LIGHTHOUSE_URL    page to audit (default http://127.0.0.1:3000/)
 *   LIGHTHOUSE_RUNS   runs per form factor; the median performance run is reported (default 3:
 *                     simulated mobile performance varies by a few points between runs)
 *   LIGHTHOUSE_MIN    minimum score per category, 0–100 (default 90)
 *   CHROME_PATH       Chrome/Chromium binary (falls back to the Playwright Chromium if present)
 *
 * Audits mobile (Lighthouse default emulation) and desktop (the desktop preset), prints the
 * four category scores for each, writes the JSON + HTML reports of the median run to
 * .lighthouse/<form factor>.{json,html} and exits non-zero when any score is below the
 * threshold (performance: the median run; the other categories: every run).
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launch } from 'chrome-launcher';
import lighthouse, { desktopConfig } from 'lighthouse';

const FALLBACK_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!process.env.CHROME_PATH && existsSync(FALLBACK_CHROME)) {
  process.env.CHROME_PATH = FALLBACK_CHROME;
}

const url = process.env.LIGHTHOUSE_URL ?? 'http://127.0.0.1:3000/';
const runs = Math.max(1, Number.parseInt(process.env.LIGHTHOUSE_RUNS ?? '3', 10) || 3);
const minScore = Number.parseInt(process.env.LIGHTHOUSE_MIN ?? '90', 10);
const outDir = path.resolve('.lighthouse');
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const FORM_FACTORS = [
  { name: 'mobile', config: undefined },
  { name: 'desktop', config: desktopConfig },
];

/** Category scores (0–100) of one Lighthouse result. */
function scoresOf(lhr) {
  return Object.fromEntries(
    CATEGORIES.map((id) => [id, Math.round((lhr.categories[id]?.score ?? 0) * 100)]),
  );
}

async function runOnce(port, config) {
  const result = await lighthouse(
    url,
    { port, output: ['json', 'html'], logLevel: 'error', onlyCategories: CATEGORIES },
    config,
  );
  if (!result) throw new Error('Lighthouse returned no result');
  if (result.lhr.runtimeError) {
    throw new Error(`Lighthouse runtime error: ${result.lhr.runtimeError.message}`);
  }
  return result;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  let failed = false;
  try {
    for (const { name, config } of FORM_FACTORS) {
      const results = [];
      for (let i = 0; i < runs; i++) {
        const result = await runOnce(chrome.port, config);
        const scores = scoresOf(result.lhr);
        results.push({ result, scores });
        if (runs > 1) console.info(`  ${name} run ${i + 1}/${runs}: ${JSON.stringify(scores)}`);
      }
      // Report the run with the median performance score (performance is the noisy one).
      results.sort((a, b) => a.scores.performance - b.scores.performance);
      const median = results[Math.floor(results.length / 2)];
      const [json, html] = median.result.report;
      await writeFile(path.join(outDir, `${name}.json`), json);
      await writeFile(path.join(outDir, `${name}.html`), html);

      console.info(`\n${name} — ${url}${runs > 1 ? ` (median of ${runs})` : ''}`);
      for (const id of CATEGORIES) {
        const score = median.scores[id];
        // Accessibility / best practices / SEO are deterministic: every run must pass.
        const worst = Math.min(...results.map((r) => r.scores[id]));
        const value = id === 'performance' ? score : worst;
        const ok = value >= minScore;
        if (!ok) failed = true;
        console.info(`  ${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(15)} ${value}`);
      }
      const m = median.result.lhr.audits;
      console.info(
        `        FCP ${m['first-contentful-paint']?.displayValue ?? '?'} · LCP ${
          m['largest-contentful-paint']?.displayValue ?? '?'
        } · TBT ${m['total-blocking-time']?.displayValue ?? '?'} · CLS ${
          m['cumulative-layout-shift']?.displayValue ?? '?'
        }`,
      );
    }
  } finally {
    await chrome.kill();
  }
  console.info(`\nReports written to ${path.relative(process.cwd(), outDir)}/`);
  if (failed) {
    console.error(`\nAt least one category scored below ${minScore}.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
