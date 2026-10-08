'use client';
/**
 * The /games catalog: search, filter chips (region, type, difficulty, players,
 * mood), a "Playable vs bot" switch and a responsive poster grid. Filters live
 * in the URL query string (shareable) and update it without a page reload.
 */
import { Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/components/ui/cn';
import { ChevronDownIcon, SpadeIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import {
  DEFAULT_FILTERS,
  PLAYERS_MAX_CHIP,
  applyFilters,
  countActive,
  filtersToQuery,
  parseFilters,
  type CatalogFilters,
  type CatalogIndex,
} from './catalog-data';
import { GameCard } from './GameCard';

export interface CatalogBrowserProps {
  index: CatalogIndex;
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <h3 id={id} className="text-gold-200 text-xs font-bold tracking-[0.16em] uppercase">
        {label}
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

interface ViewProps {
  index: CatalogIndex;
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
}

function CatalogView({ index, filters, onChange }: ViewProps) {
  const reduced = useReducedMotionPref();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const results = useMemo(() => applyFilters(index, filters), [index, filters]);
  const total = index.cards.length;
  const active = countActive(filters);
  const { options } = index;

  const set = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch });
  const countWith = (patch: Partial<CatalogFilters>) =>
    applyFilters(index, { ...filters, ...patch }).length;

  // Announce the result count after the learner pauses (not on first render).
  const queryKey = filtersToQuery(filters);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      announce(
        results.length === 0
          ? t('catalog.results.emptyTitle')
          : results.length === 1
            ? t('catalog.results.countOne', { total })
            : t('catalog.results.count', { shown: results.length, total }),
      );
    }, 450);
    return () => window.clearTimeout(id);
  }, [results.length, total, queryKey]);

  // The reset buttons disappear once nothing is filtered: hand focus to the result count.
  const countRef = useRef<HTMLParagraphElement>(null);
  const reset = () => {
    onChange(DEFAULT_FILTERS);
    countRef.current?.focus({ preventScroll: true });
  };

  const countText =
    active === 0
      ? t('catalog.results.all', { total })
      : results.length === 1
        ? t('catalog.results.countOne', { total })
        : t('catalog.results.count', { shown: results.length, total });

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <form
          role="search"
          aria-label={t('catalog.filters.label')}
          onSubmit={(e) => e.preventDefault()}
          className="panel p-4 sm:p-5"
        >
          <h2 className="sr-only">{t('catalog.filters.label')}</h2>
          <TextField
            type="search"
            label={t('catalog.filters.searchLabel')}
            placeholder={t('catalog.filters.searchPlaceholder')}
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            enterKeyHint="search"
            autoComplete="off"
            maxLength={80}
            data-testid="catalog-search"
          />

          <button
            type="button"
            aria-expanded={panelOpen}
            aria-controls={panelId}
            onClick={() => setPanelOpen((o) => !o)}
            className="border-gold-300/40 text-gold-200 hover:border-gold-300 mt-4 flex min-h-11 w-full items-center justify-between rounded-xl border px-4 text-sm font-bold lg:hidden"
            data-testid="catalog-filters-toggle"
          >
            <span>
              {active > 0
                ? t('catalog.filters.toggleActive', { count: active })
                : t('catalog.filters.toggle')}
            </span>
            <ChevronDownIcon
              size={18}
              className={cn('transition-transform duration-200', panelOpen && 'rotate-180')}
            />
          </button>

          <div
            id={panelId}
            className={cn('mt-5 space-y-5', panelOpen ? 'block' : 'hidden lg:block')}
          >
            <Switch
              checked={filters.playable}
              onCheckedChange={(playable) => set({ playable })}
              label={t('catalog.filters.playable')}
              hint={t('catalog.filters.playableHint')}
            />

            <ChipGroup label={t('catalog.filters.region')}>
              {options.region.map((o) => (
                <Chip
                  key={o.value}
                  size="sm"
                  selected={filters.region === o.value}
                  onSelectedChange={(on) => set({ region: on ? o.value : 'all' })}
                  count={countWith({ region: o.value })}
                >
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup label={t('catalog.filters.type')}>
              {options.type.map((o) => (
                <Chip
                  key={o.value}
                  size="sm"
                  selected={filters.type === o.value}
                  onSelectedChange={(on) => set({ type: on ? o.value : 'all' })}
                  count={countWith({ type: o.value })}
                >
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup label={t('catalog.filters.difficulty')}>
              {options.difficulty.map((n) => (
                <Chip
                  key={n}
                  size="sm"
                  selected={filters.difficulty === n}
                  onSelectedChange={(on) => set({ difficulty: on ? n : 'all' })}
                  count={countWith({ difficulty: n })}
                  aria-label={t('catalog.card.difficulty', { value: n })}
                >
                  <span aria-hidden="true" className="inline-flex items-center gap-[3px]">
                    {Array.from({ length: n }, (_, i) => (
                      <span key={i} className="size-[7px] rotate-45 rounded-[1px] bg-current" />
                    ))}
                  </span>
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup label={t('catalog.filters.players')}>
              {options.players.map((n) => (
                <Chip
                  key={n}
                  size="sm"
                  selected={filters.players === n}
                  onSelectedChange={(on) => set({ players: on ? n : 'all' })}
                  count={countWith({ players: n })}
                >
                  {n >= PLAYERS_MAX_CHIP
                    ? t('catalog.filters.playersMany', { n })
                    : t('catalog.filters.playersOption', { n })}
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup label={t('catalog.filters.mood')}>
              {options.mood.map((o) => (
                <Chip
                  key={o.value}
                  size="sm"
                  selected={filters.mood === o.value}
                  onSelectedChange={(on) => set({ mood: on ? o.value : 'all' })}
                  count={countWith({ mood: o.value })}
                >
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>

            {active > 0 ? (
              <Button variant="ghost" size="sm" onClick={reset}>
                {t('catalog.filters.reset')}
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p
            ref={countRef}
            tabIndex={-1}
            className="text-mist text-sm font-semibold tabular-nums outline-none"
            data-testid="catalog-count"
          >
            {countText}
          </p>
          {active > 0 ? (
            // Always visible (the filter panel is collapsed on phones), so it carries the test id.
            <button
              type="button"
              onClick={reset}
              data-testid="catalog-reset"
              className="text-gold-200 hover:text-gold-100 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
            >
              {t('catalog.filters.reset')}
            </button>
          ) : null}
        </div>

        {results.length === 0 ? (
          <div
            className="panel flex flex-col items-center px-6 py-14 text-center"
            data-testid="catalog-empty"
          >
            <SpadeIcon size={40} className="text-gold-300/70" />
            <h2 className="font-display text-gold-100 mt-4 text-2xl font-bold">
              {t('catalog.results.emptyTitle')}
            </h2>
            <p className="text-mist mt-2 max-w-sm">{t('catalog.results.emptyBody')}</p>
            <Button className="mt-6" onClick={reset}>
              {t('catalog.filters.reset')}
            </Button>
          </div>
        ) : (
          <ul
            aria-label={t('catalog.results.listLabel')}
            className="grid grid-cols-1 gap-5 min-[560px]:grid-cols-2 xl:grid-cols-3"
          >
            <AnimatePresence initial={false}>
              {results.map((game) => (
                <motion.li
                  key={game.slug}
                  layout={!reduced}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: reduced ? 0.1 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex"
                >
                  <GameCard game={game} className="w-full" />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

/** Owns the filter state and keeps it in sync with the URL. */
function UrlCatalog({ index }: CatalogBrowserProps) {
  const params = useSearchParams();
  const paramsKey = params.toString();
  const [filters, setFilters] = useState<CatalogFilters>(() => parseFilters(params, index.options));
  // Query strings we wrote ourselves and are waiting for the router to echo back.
  const [pending, setPending] = useState<string[]>([]);
  const [seenKey, setSeenKey] = useState(paramsKey);

  if (seenKey !== paramsKey) {
    setSeenKey(paramsKey);
    const at = pending.indexOf(paramsKey);
    if (at >= 0) {
      setPending(pending.slice(at + 1));
    } else {
      // The URL changed from outside (a link, back/forward): follow it.
      setPending([]);
      setFilters(parseFilters(params, index.options));
    }
  }

  const change = (next: CatalogFilters) => {
    setFilters(next);
    const qs = filtersToQuery(next);
    setPending((p) => [...p, qs]);
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', url);
  };

  return <CatalogView index={index} filters={filters} onChange={change} />;
}

/** Server-rendered (and no-JS) view: every game, no filters applied. */
function StaticCatalog({ index }: CatalogBrowserProps) {
  return <CatalogView index={index} filters={DEFAULT_FILTERS} onChange={() => {}} />;
}

export function CatalogBrowser({ index }: CatalogBrowserProps) {
  return (
    <Suspense fallback={<StaticCatalog index={index} />}>
      <UrlCatalog index={index} />
    </Suspense>
  );
}
