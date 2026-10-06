# PROGRESS

_Last updated: all milestones complete; Definition of Done audited._

## Done

- Milestones 1–8 from `docs/PLAN.md`: shell, design system, wallet + Daily Udhaar, contact, SVG cards +
  primer, Blackjack reference, 11 more Tier 1 games (engine + board + coach + bots), 19 Tier 2 games,
  Community Board + admin + ratings + contact form, stats/awards/share cards/journey/pick-a-game,
  accessibility, Lighthouse, SEO, screenshots, README.
- Verification (latest): `npm run lint` ✓, `npm run typecheck` ✓, `npm run test` 3,447 tests / 202 files ✓,
  `npm run e2e` 139 tests (desktop + 375 px mobile, incl. screenshots spec) ✓,
  Lighthouse on `/` (median of 3): mobile 90/100/100/100, desktop 100/100/100/100.

## Open issues / known limitations

- Mobile Lighthouse performance sits at the 90 threshold (fonts are the main LCP cost; subsetting
  Fraunces would add headroom).
- `/games/<tier-2>/play` renders the not-found page with HTTP 200 + noindex (play `loading.tsx`
  streams before notFound); not linked or in the sitemap.
- Rate limiting is in-memory per instance; admin sessions are stateless 8 h cookies.
- Set `NEXT_PUBLIC_SITE_URL` at build time in production (sitemap/canonical/OG URLs).

## Next step

- Optional upgrades: promote a Tier 2 game to Tier 1 (see README "How to add a new game"), Hindi
  dictionaries, multiplayer, an AI tutor.
