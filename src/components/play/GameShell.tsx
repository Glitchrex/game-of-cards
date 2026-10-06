'use client';
/**
 * The play-mode container behind /games/[slug]/play. Every Tier 1 game plugs in
 * through its GameModule (engine + Board + betting + bots):
 *
 *   bet ──Deal──▶ play ──game over──▶ result (overlay) ──Play again──▶ bet
 *
 * Money follows the escrow rules in docs/DECISIONS.md D-04 (src/lib/settle.ts): the
 * worst-case loss is set aside before the deal, the game settles once at the end, and
 * leaving mid-hand (unmount or `pagehide`) forfeits exactly one stake.
 *
 * Every side effect that must happen once per game (escrow, settlement, stats, awards,
 * sounds, announcements) runs in an event handler, a timer or a ref-guarded callback, so
 * React StrictMode's double rendering / effect replay never doubles it.
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Roast as RoastLine, type WinTitle } from '@content/titles';
import { announce } from '@/components/layout/LiveAnnouncer';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { AlertIcon, BookIcon, CloseIcon, InfoIcon, SparkleIcon } from '@/components/ui/icons';
import { CardBack } from '@/components/cards';
import { CoinIcon, JeetAmount, formatJeet } from '@/components/ui/Jeet';
import { toast } from '@/components/ui/Toast';
import { type GameModule } from '@/games/core/module';
import { randomSeed } from '@/games/core/rng';
import { type Difficulty, type GameConfig, type GameResult } from '@/games/core/types';
import { t } from '@/lib/i18n';
import { abandonRefund, affordableUnits, escrowFor, settle } from '@/lib/settle';
import { playSound } from '@/lib/sound';
import { buildTitleContext, pickRoast, pickTip, pickTitle } from '@/lib/titles';
import { useHydrated } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { BetPanel } from './BetPanel';
import { BotAvatar } from './BotAvatar';
import { Celebration } from './Celebration';
import { CoachPanel } from './CoachPanel';
import { MoveLog } from './MoveLog';
import { joinNames, seatPersonas } from './personas';
import { PushOverlay } from './PushOverlay';
import { Roast } from './Roast';
import { TurnIndicator } from './Seat';
import { TableFrame, TableSkeleton } from './TableFrame';
import { HUMAN, learnerSituation, useGameController } from './useGameController';
import { useGameModule } from './useGameModule';

export interface GameShellProps {
  slug: string;
  gameName: string;
  /** The game's tips (content file) — one is shown after every loss. */
  tips: string[];
  /** Fixed seed from ?seed= (deterministic E2E, docs/DECISIONS.md D-15). */
  seed?: string;
  /** Preselected bot difficulty from ?difficulty=. */
  difficulty?: Difficulty;
}

/** Pause between the final move and the result overlay, so the last cards are seen. */
export const RESULT_REVEAL_MS = 1100;

type Phase = 'bet' | 'play' | 'result';

interface ActiveGame {
  id: number;
  stake: number;
  escrow: number;
  seed: number | string;
  difficulty: Difficulty;
  config: GameConfig;
}

/** The money side of the game in progress, read by the settlement and abandon guards. */
interface LiveGame {
  escrow: number;
  stake: number;
  maxLossUnits: number;
  settled: boolean;
}

type Outcome =
  | { kind: 'win'; title: WinTitle; netJeet: number; awardIndex: number; summary: string }
  | { kind: 'loss'; roast: RoastLine; tip: string; netJeet: number; summary: string }
  | { kind: 'push'; netJeet: number; summary: string };

export function GameShell(props: GameShellProps) {
  const { status, module: mod, retry } = useGameModule(props.slug);
  const hydrated = useHydrated();

  if (status === 'error') {
    return (
      <div data-testid="game-shell" data-phase="error" className="panel px-5 py-8 text-center">
        <AlertIcon size={28} className="text-velvet-300 mx-auto" />
        <p className="font-display text-gold-100 mt-3 text-xl font-bold">
          {t('play.shell.loadError')}
        </p>
        <p className="text-mist mt-1 text-sm">{t('play.shell.loadErrorHint')}</p>
        <Button className="mt-5" onClick={retry}>
          {t('play.shell.retry')}
        </Button>
      </div>
    );
  }
  if (!mod || !hydrated) {
    return (
      <div data-testid="game-shell" data-phase="loading">
        <TableSkeleton />
      </div>
    );
  }
  return <PlayStage key={props.slug} mod={mod} {...props} />;
}

interface StageProps extends GameShellProps {
  mod: GameModule;
}

function PlayStage({
  mod,
  slug,
  gameName,
  tips,
  seed: fixedSeed,
  difficulty: initialDifficulty,
}: StageProps) {
  const balance = useWallet((s) => s.balance);
  const botSpeed = useSettings((s) => s.botSpeed);
  const [phase, setPhase] = useState<Phase>('bet');
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [revealPending, setRevealPending] = useState(false);
  const [lastStake, setLastStake] = useState<number | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(initialDifficulty);
  const [notice, setNotice] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  /** The escrow of the game in progress (null between games). Read by the abandon guard. */
  const live = useRef<LiveGame | null>(null);
  const lastTip = useRef<string | null>(null);
  const counter = useRef(0);

  const deal = (stake: number, chosen: Difficulty) => {
    const escrow = escrowFor(stake, mod.betting.maxLossUnits);
    if (!useWallet.getState().placeBet(escrow, slug)) {
      toast({ message: t('play.shell.betFailed'), tone: 'error' });
      return;
    }
    const after = useWallet.getState().balance;
    counter.current += 1;
    live.current = { escrow, stake, maxLossUnits: mod.betting.maxLossUnits, settled: false };
    setGame({
      id: counter.current,
      stake,
      escrow,
      seed: fixedSeed ?? randomSeed(),
      difficulty: chosen,
      config: { ...mod.defaultConfig, affordableUnits: affordableUnits(after, stake) },
    });
    setOutcome(null);
    setOverlayOpen(false);
    setNotice(null);
    setLastStake(stake);
    setDifficulty(chosen);
    setPhase('play');
    playSound('shuffle');
    // The table announces the deal itself once it is set up (see PlayTable).
  };

  const finish = useCallback(
    (result: GameResult) => {
      const g = live.current;
      if (!g || g.settled) return;
      g.settled = true;

      const s = settle(g.escrow, g.stake, result.humanNetUnits);
      const wallet = useWallet.getState();
      if (s.credit > 0) {
        wallet.credit(s.credit, slug, result.humanOutcome === 'win' ? 'payout' : 'refund');
      }
      if (s.debit > 0) {
        // Extra bets (doubles, splits) are only allowed up to what the wallet covered at the
        // deal, so this is normally the full amount. If the balance shrank since (another
        // tab), take what is there rather than skipping the debit.
        const owed = Math.min(s.debit, useWallet.getState().balance);
        if (owed > 0) useWallet.getState().placeBet(owed, slug);
        if (owed < s.debit) console.error('Settlement debit was only partly covered', s);
      }

      const stats = useStats.getState();
      const statsBefore = stats.recordGame({
        gameSlug: slug,
        outcome: result.humanOutcome,
        net: s.netJeet,
      });
      const ctx = buildTitleContext({
        gameSlug: slug,
        gameName,
        humanNetUnits: result.humanNetUnits,
        stake: g.stake,
        flags: result.flags,
        statsBefore,
      });

      if (result.humanOutcome === 'win') {
        useProgress.getState().recordWin(slug);
        const title = pickTitle(ctx, stats.lastTitleId);
        stats.setLastTitle(title.id);
        stats.addAward({
          titleId: title.id,
          text: title.text,
          film: title.film,
          gameSlug: slug,
          jeet: s.netJeet,
        });
        setOutcome({
          kind: 'win',
          title,
          netJeet: s.netJeet,
          awardIndex: useStats.getState().awards.length,
          summary: result.summary,
        });
      } else if (result.humanOutcome === 'loss') {
        const roast = pickRoast(ctx, stats.lastRoastId);
        stats.setLastRoast(roast.id);
        const tip = pickTip(tips, lastTip.current);
        lastTip.current = tip;
        setOutcome({ kind: 'loss', roast, tip, netJeet: s.netJeet, summary: result.summary });
      } else {
        setOutcome({ kind: 'push', netJeet: s.netJeet, summary: result.summary });
      }
      setPhase('result');
      setRevealPending(true);
    },
    [slug, gameName, tips],
  );

  // Reveal the result overlay after a short beat, with sound and an announcement (the
  // engine's plain-English summary first, so screen-reader users hear how the hand ended).
  useEffect(() => {
    if (!revealPending || !outcome) return;
    const id = window.setTimeout(() => {
      setRevealPending(false);
      setOverlayOpen(true);
      const summary = outcome.summary;
      if (outcome.kind === 'win') {
        playSound('win');
        announce(
          t('play.shell.outcomeWin', {
            summary,
            amount: formatJeet(outcome.netJeet),
            title: outcome.title.text,
          }),
          'assertive',
        );
      } else if (outcome.kind === 'loss') {
        playSound('lose');
        announce(
          t('play.shell.outcomeLoss', {
            summary,
            amount: formatJeet(Math.abs(outcome.netJeet)),
            roast: outcome.roast.text,
          }),
          'assertive',
        );
      } else {
        playSound('coin');
        announce(t('play.shell.outcomePush', { summary }), 'assertive');
      }
    }, RESULT_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [revealPending, outcome]);

  // Leaving mid-hand forfeits one stake (or, in pot games, the whole escrow): settle exactly once.
  useEffect(() => {
    /** Settles an abandoned game; returns the learner-facing explanation (null if none). */
    const forfeit = (): string | null => {
      const g = live.current;
      if (!g || g.settled) return null;
      g.settled = true;
      const refund = abandonRefund(g.escrow, g.stake, g.maxLossUnits);
      if (refund > 0) useWallet.getState().credit(refund, slug, 'refund');
      return refund > 0
        ? t('play.shell.abandoned', { amount: formatJeet(g.stake) })
        : g.maxLossUnits > 1
          ? t('play.shell.abandonedAll', { amount: formatJeet(g.escrow) })
          : t('play.shell.abandonedBet', { amount: formatJeet(g.escrow) });
    };
    const onPageHide = () => {
      const message = forfeit();
      if (message === null) return;
      // Only seen if this page is shown again (back/forward cache).
      setGame(null);
      setPhase('bet');
      setNotice(message);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      // Client-side navigation away mid-hand: the toast follows the learner to the next page.
      const message = forfeit();
      if (message !== null) toast({ message, tone: 'info' });
    };
  }, [slug]);

  const backToBet = () => {
    live.current = null;
    setRevealPending(false);
    setOverlayOpen(false);
    setOutcome(null);
    setGame(null);
    setReturning(true);
    setPhase('bet');
  };

  const botDelayMs = BOT_DELAY_MS[botSpeed];

  return (
    <div data-testid="game-shell" data-phase={phase} className="flex flex-col gap-5">
      {notice ? (
        <div
          role="status"
          data-testid="abandon-notice"
          className="border-gold-300/40 bg-felt-950/60 text-cream flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
        >
          <InfoIcon size={18} className="text-gold-300 mt-0.5 shrink-0" />
          <p className="min-w-0 flex-1 leading-snug">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={t('play.shell.dismiss')}
            className="text-mist hover:text-gold-100 -my-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      ) : null}

      {phase === 'bet' || !game ? (
        <BetStage
          mod={mod}
          slug={slug}
          gameName={gameName}
          balance={balance}
          initialStake={lastStake}
          initialDifficulty={difficulty}
          focusDeal={returning}
          onDeal={deal}
        />
      ) : (
        <PlayTable
          key={game.id}
          mod={mod}
          game={game}
          slug={slug}
          gameName={gameName}
          botDelayMs={botDelayMs}
          onOver={finish}
          handOver={
            phase === 'result' && outcome && !overlayOpen && !revealPending ? outcome.summary : null
          }
          onShowResult={() => setOverlayOpen(true)}
          onPlayAgain={backToBet}
        />
      )}

      {outcome?.kind === 'win' ? (
        <Celebration
          open={overlayOpen}
          title={outcome.title}
          gameName={gameName}
          gameSlug={slug}
          netJeet={outcome.netJeet}
          awardIndex={outcome.awardIndex}
          summary={outcome.summary}
          onPlayAgain={backToBet}
          onClose={() => setOverlayOpen(false)}
        />
      ) : null}
      {outcome?.kind === 'loss' ? (
        <Roast
          open={overlayOpen}
          roast={outcome.roast}
          tip={outcome.tip}
          gameName={gameName}
          gameSlug={slug}
          netJeet={outcome.netJeet}
          summary={outcome.summary}
          onRematch={backToBet}
          onClose={() => setOverlayOpen(false)}
        />
      ) : null}
      {outcome?.kind === 'push' ? (
        <PushOverlay
          open={overlayOpen}
          gameName={gameName}
          gameSlug={slug}
          summary={outcome.summary}
          onPlayAgain={backToBet}
          onClose={() => setOverlayOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ bet phase */

/** "You vs Mona and Raju", or "Just you and the deck" for solitaire games (no bots). */
function opponentsLine(mod: GameModule): string {
  return mod.bots.length > 0
    ? t('play.shell.vs', { names: joinNames(mod.bots.map((b) => b.name)) })
    : t('play.shell.solo');
}

function BetStage({
  mod,
  slug,
  gameName,
  balance,
  initialStake,
  initialDifficulty,
  focusDeal,
  onDeal,
}: {
  mod: GameModule;
  slug: string;
  gameName: string;
  balance: number;
  initialStake?: number;
  initialDifficulty?: Difficulty;
  focusDeal: boolean;
  onDeal: (stake: number, difficulty: Difficulty) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusDeal) return;
    rootRef.current
      ?.querySelector<HTMLElement>('[data-testid="deal-button"]')
      ?.focus({ preventScroll: false });
  }, [focusDeal]);

  return (
    <div ref={rootRef} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
      <TableFrame
        fill
        label={t('play.shell.opponents')}
        header={
          <div>
            <p className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.22em] uppercase">
              {t('play.shell.opponents')}
            </p>
            <p className="font-display text-gold-100 text-xl leading-tight font-bold sm:text-2xl">
              {opponentsLine(mod)}
            </p>
          </div>
        }
        aside={
          <Button
            variant="ghost"
            size="sm"
            href={`/games/${slug}/learn`}
            aria-label={t('play.shell.rulesLabel', { name: gameName })}
            leadingIcon={<BookIcon size={18} />}
          >
            {t('play.shell.rules')}
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-6 py-2 sm:py-4">
          <div aria-hidden="true" className="hidden items-end sm:flex">
            {[-14, -5, 5, 14].map((deg, i) => (
              <CardBack
                key={deg}
                size="sm"
                className="-ml-6 first:ml-0"
                style={{
                  transform: `rotate(${deg}deg) translateY(${i === 1 || i === 2 ? -6 : 0}px)`,
                }}
              />
            ))}
          </div>
          {mod.bots.length > 0 ? (
            <ul className="grid w-full gap-3 sm:grid-cols-2">
              {mod.bots.map((bot) => (
                <li
                  key={bot.name}
                  className="border-gold-300/20 bg-felt-950/40 flex items-center gap-3 rounded-2xl border px-3 py-2.5"
                >
                  <BotAvatar persona={bot} size={64} />
                  <div className="min-w-0">
                    <p className="text-gold-100 font-bold">{bot.name}</p>
                    <p className="text-mist text-sm leading-snug">{bot.tagline}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-mist flex items-start gap-2 text-sm leading-snug">
            <SparkleIcon size={16} className="text-gold-300 mt-0.5 shrink-0" />
            <span>
              {t('play.shell.practiceInstead', { name: gameName })}{' '}
              <Link
                href={`/games/${slug}/try`}
                className="text-gold-200 hover:text-gold-100 font-semibold underline underline-offset-2"
              >
                {t('play.page.practise')}
              </Link>
            </span>
          </p>
        </div>
      </TableFrame>

      <BetPanel
        betting={mod.betting}
        gameName={gameName}
        balance={balance}
        initialStake={initialStake}
        initialDifficulty={initialDifficulty}
        difficulties={mod.difficulties}
        onDeal={onDeal}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- play phase */

/**
 * What the learner can see right after the deal, in words: the coach's situation when it is
 * their move, otherwise the view from their seat (e.g. "You have Blackjack! …" while the
 * dealer turns the hole card over).
 */
function openingSituation(
  mod: GameModule,
  state: unknown,
  yourTurnSituation: string | undefined,
): string | null {
  if (yourTurnSituation) return yourTurnSituation;
  return mod.engine.isOver(state) ? null : learnerSituation(mod, state);
}

function PlayTable({
  mod,
  game,
  slug,
  gameName,
  botDelayMs,
  onOver,
  handOver,
  onShowResult,
  onPlayAgain,
}: {
  mod: GameModule;
  game: ActiveGame;
  slug: string;
  gameName: string;
  botDelayMs: number;
  onOver: (result: GameResult) => void;
  /** Result summary once the overlay has been closed (null otherwise). */
  handOver: string | null;
  onShowResult: () => void;
  onPlayAgain: () => void;
}) {
  // Optional coach during real play: hints and "Play it for me" for nervous beginners.
  const [coachOn, setCoachOn] = useState(false);
  const c = useGameController({
    module: mod,
    config: game.config,
    seed: game.seed,
    difficulty: game.difficulty,
    botDelayMs,
    coachMode: coachOn,
    onOver,
  });
  const personas = useMemo(() => seatPersonas(mod.bots), [mod.bots]);
  const canHint = coachOn && !c.over && c.advice !== null && c.advice.suggestion !== undefined;
  const autoplay = () => {
    if (c.advice?.suggestion !== undefined) c.attempt(c.advice.suggestion);
  };
  const tableRef = useRef<HTMLElement>(null);
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const dealtAnnounced = useRef(false);
  const Board = mod.Board;

  // The result overlay opened by itself, so "return focus to the opener" would land on a
  // spent action button: when it closes, start keyboard users on the hand-over bar instead.
  useEffect(() => {
    if (handOver !== null) playAgainRef.current?.focus();
  }, [handOver]);

  // A new hand: move focus to the table and tell screen-reader users what was dealt.
  // (The ref survives StrictMode's effect replay, so this is announced once.)
  useEffect(() => {
    tableRef.current?.focus();
    if (dealtAnnounced.current) return;
    dealtAnnounced.current = true;
    const dealt = t('play.shell.dealt', { amount: formatJeet(game.stake) });
    const situation = openingSituation(mod, c.state, c.advice?.situation);
    announce(situation ? `${dealt} ${situation}` : dealt);
    // Mount only: the opening deal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <TableFrame
        ref={tableRef}
        tabIndex={-1}
        label={t('play.shell.region', { name: gameName })}
        data-testid="play-table"
        header={
          <div className="min-w-0">
            <p className="font-display text-gold-100 truncate text-xl leading-tight font-bold sm:text-2xl">
              {gameName}
            </p>
            <p className="text-mist truncate text-xs">{opponentsLine(mod)}</p>
          </div>
        }
        aside={
          <>
            <span className="border-gold-300/40 bg-felt-950/70 text-gold-100 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-bold">
              <span className="text-mist font-semibold">{t('play.shell.yourBet')}</span>{' '}
              <JeetAmount amount={game.stake} coinSize={16} />
            </span>
            <Button
              variant={coachOn ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={coachOn}
              aria-label={t('play.coach.toggleLabel')}
              data-testid="coach-toggle"
              onClick={() => setCoachOn((v) => !v)}
              leadingIcon={<SparkleIcon size={16} />}
            >
              {coachOn ? t('play.coach.toggleOn') : t('play.coach.toggleOff')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              href={`/games/${slug}/learn`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t('play.shell.rulesLabel', { name: gameName })} (${t('play.shell.newTab')})`}
              leadingIcon={<BookIcon size={18} />}
            >
              {t('play.shell.rules')}
            </Button>
          </>
        }
        status={
          <TurnIndicator
            yourTurn={c.current === HUMAN && !c.over}
            thinkingName={c.thinking !== null ? c.nameOf(c.thinking) : null}
            forced={c.botForced}
            over={c.over}
          />
        }
        footer={
          c.lastError || handOver ? (
            <div className="flex flex-col gap-2 pb-1">
              {c.lastError ? (
                <div
                  key={c.errorSeq}
                  role="alert"
                  data-testid="move-error"
                  className="border-velvet-400/70 bg-velvet-700/90 text-cream flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-[0_14px_30px_-16px_rgb(0_0_0/0.9)]"
                >
                  <AlertIcon size={18} className="text-velvet-300 mt-0.5 shrink-0" />
                  <p className="min-w-0 flex-1 leading-snug">
                    <span className="font-bold">{t('play.shell.errorTitle')}: </span>
                    {c.lastError}
                  </p>
                  <button
                    type="button"
                    onClick={c.clearError}
                    aria-label={t('play.shell.dismiss')}
                    className="text-cream/80 hover:text-cream -my-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              ) : null}
              {handOver ? (
                <div
                  data-testid="hand-over"
                  className="border-gold-300/30 bg-felt-900/90 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                >
                  <p className="text-cream min-w-0 flex-1 text-sm leading-snug">
                    <span className="text-gold-300 font-bold">{t('play.shell.handOver')}: </span>
                    {handOver}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={onShowResult}>
                      {t('play.shell.showResult')}
                    </Button>
                    <Button
                      ref={playAgainRef}
                      size="sm"
                      onClick={onPlayAgain}
                      data-testid="play-again-bar"
                    >
                      {t('play.shell.playAgain')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null
        }
      >
        <Board
          state={c.state}
          human={HUMAN}
          legalMoves={c.legal}
          onMove={c.attempt}
          busy={c.busy}
          thinking={c.thinking}
          coachMode={coachOn}
          highlight={c.highlight}
          suggestedKey={c.suggestedKey}
          personas={personas}
          over={c.over}
        />
      </TableFrame>

      <div className="flex flex-col gap-4 lg:sticky lg:top-24">
        {coachOn ? (
          <CoachPanel
            situation={
              <p>
                {c.over
                  ? (c.result?.summary ?? '')
                  : c.advice
                    ? c.advice.situation
                    : c.thinking !== null
                      ? t('play.coach.waiting', { name: c.nameOf(c.thinking) })
                      : t('play.coach.yourTurnPrompt')}
              </p>
            }
            error={c.lastError}
            errorKey={c.errorSeq}
            onHint={canHint ? c.showHint : undefined}
            onAutoplay={canHint ? autoplay : undefined}
            hintRevealed={c.suggestedKey !== null && c.advice ? (c.advice.why ?? null) : null}
          />
        ) : null}
        <section
          aria-label={t('play.shell.yourBet')}
          className={cn('panel flex flex-col gap-2 px-4 py-3 text-sm')}
        >
          <p className="flex items-center justify-between gap-3">
            <span className="text-mist font-semibold">{t('play.shell.yourBet')}</span>{' '}
            <JeetAmount amount={game.stake} showUnit className="text-gold-100" />
          </p>
          {game.escrow > game.stake ? (
            <>
              <p className="flex items-center justify-between gap-3">
                <span className="text-mist font-semibold">{t('play.shell.setAside')}</span>{' '}
                <span className="text-cream inline-flex items-center gap-1.5 font-bold">
                  <CoinIcon size={16} />
                  <span className="tabular">{formatJeet(game.escrow)}</span>{' '}
                  <span>{t('wallet.currency')}</span>
                </span>
              </p>
              <p className="text-mist text-xs leading-snug">{t('play.shell.setAsideHint')}</p>
            </>
          ) : null}
        </section>
        <MoveLog log={c.log} />
      </div>
    </div>
  );
}
