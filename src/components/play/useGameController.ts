'use client';
/**
 * Drives any GameEngine in the browser: holds the state, runs bot turns with a
 * "thinking" delay, validates the learner's attempted moves (explaining illegal
 * ones), produces coach advice and screen-reader announcements.
 *
 * It is UI-agnostic: GameShell (play mode) and the coached practice hand both use it.
 *
 * Announcements: every applied move is announced politely (and logged). Illegal-move
 * reasons and coach hints are NOT announced here — the UI shows them in live regions
 * (the coach panel's `role="alert"` error and hint region, the play-mode callout), keyed
 * by `errorSeq` so that repeating the same mistake is announced again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRng, type Rng } from '@/games/core/rng';
import type {
  CoachAdvice,
  Difficulty,
  GameConfig,
  GameResult,
  MoveCheck,
  PlayerId,
} from '@/games/core/types';
import type { BotPersona, GameModule } from '@/games/core/module';
import { announce } from '@/components/layout/LiveAnnouncer';
import { t } from '@/lib/i18n';
import { playSound } from '@/lib/sound';

export const HUMAN: PlayerId = 0;

export interface ControllerOptions<S, M> {
  module: GameModule<S, M>;
  config: GameConfig;
  seed: number | string;
  difficulty: Difficulty;
  /** Base bot thinking delay (ms). Forced single-option moves use a shorter delay. */
  botDelayMs: number;
  /** Practice mode keeps legal-move highlighting on. */
  coachMode: boolean;
  /** Called once when the game ends. */
  onOver?: (result: GameResult, state: S) => void;
  /** Start paused (e.g. until the bet is placed). */
  paused?: boolean;
}

export interface LogEntry {
  id: number;
  player: PlayerId;
  text: string;
}

export interface GameController<S, M> {
  state: S;
  current: PlayerId | null;
  /** Legal moves for the learner right now. */
  legal: M[];
  over: boolean;
  result: GameResult | null;
  /** Seat that is currently "thinking", or null. */
  thinking: PlayerId | null;
  /**
   * The thinking bot has exactly one legal move (e.g. a dealer drawing to 17), so the UI can
   * say it "is playing…" rather than "is thinking…". False when no bot is thinking.
   */
  botForced: boolean;
  /** True when the learner cannot act (bot turn / over / paused). */
  busy: boolean;
  /** Submit a move for the learner. Returns the legality check. */
  attempt: (move: M) => MoveCheck;
  /** Last "why is that illegal?" explanation, if any. */
  lastError: string | null;
  /**
   * Increments on every rejected attempt (even when the reason text repeats). Use it as
   * a React `key` on the element that shows `lastError` so screen readers re-announce it.
   */
  errorSeq: number;
  clearError: () => void;
  /** Coach advice for the learner (only when it is their turn). */
  advice: CoachAdvice | null;
  /** Reveal the coach's suggested move ("What would a pro do?"). */
  showHint: () => void;
  suggestedKey: string | null;
  /** moveKey()s of legal moves (for highlighting in coach mode). */
  highlight: ReadonlySet<string>;
  log: LogEntry[];
  personas: BotPersona[];
  /** Restart with a new seed (or the same one). */
  restart: (seed?: number | string) => void;
  /** Persona-aware display name for a seat. */
  nameOf: (player: PlayerId) => string;
}

/** Replace "Player N" in engine descriptions with persona names. */
export function personalise(text: string, personas: readonly BotPersona[]): string {
  return text.replace(/\bPlayer (\d+)\b/g, (whole, n: string) => {
    const p = personas[Number(n) - 1];
    return p ? p.name : whole;
  });
}

/**
 * What the learner's seat can see, in words — `engine.coach(state, HUMAN).situation`,
 * personalised — even when it is not their move (e.g. "The dealer has 16 and must draw").
 * Engines only describe what that seat may know. Null when the engine has nothing to say.
 */
export function learnerSituation<S, M>(mod: GameModule<S, M>, state: S): string | null {
  try {
    const text = mod.engine.coach(state, HUMAN).situation;
    return text ? personalise(text, mod.bots) : null;
  } catch {
    return null;
  }
}

export function useGameController<S, M>(opts: ControllerOptions<S, M>): GameController<S, M> {
  const { module: mod, config, difficulty, botDelayMs, coachMode, paused = false } = opts;
  const engine = mod.engine;
  const personas = mod.bots;

  const [seed, setSeed] = useState(opts.seed);
  const [state, setState] = useState<S>(() => engine.setup(config, createRng(opts.seed)));
  const [lastError, setLastError] = useState<string | null>(null);
  const [errorSeq, setErrorSeq] = useState(0);
  const [suggestedKey, setSuggestedKey] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const botRng = useRef<Rng>(createRng(`bot-${String(opts.seed)}`));
  const logId = useRef(0);
  const overFired = useRef(false);
  const onOverRef = useRef(opts.onOver);
  useEffect(() => {
    onOverRef.current = opts.onOver;
  });

  const over = engine.isOver(state);
  const current = over ? null : engine.currentPlayer(state);
  const legal = useMemo(
    () => (current === HUMAN && !over ? engine.legalMoves(state, HUMAN) : []),
    [engine, state, current, over],
  );
  const highlight = useMemo(
    () => new Set(coachMode ? legal.map((m) => engine.moveKey(m)) : []),
    [engine, legal, coachMode],
  );
  const result = useMemo(() => (over ? engine.result(state) : null), [engine, state, over]);
  // The seat whose bot is "thinking" is simply the current non-human seat.
  const thinking: PlayerId | null =
    !paused && !over && current !== null && current !== HUMAN ? current : null;
  const botForced = useMemo(
    () => thinking !== null && engine.legalMoves(state, thinking).length <= 1,
    [engine, state, thinking],
  );
  const rawAdvice = useMemo(
    () => (current === HUMAN && !over ? engine.coach(state, HUMAN) : null),
    [engine, state, current, over],
  );
  const advice = useMemo<CoachAdvice | null>(
    () =>
      rawAdvice
        ? {
            ...rawAdvice,
            situation: personalise(rawAdvice.situation, personas),
            why: rawAdvice.why ? personalise(rawAdvice.why, personas) : undefined,
          }
        : null,
    [rawAdvice, personas],
  );

  const nameOf = useCallback(
    (p: PlayerId) => (p === HUMAN ? t('play.seat.you') : (personas[p - 1]?.name ?? `Player ${p}`)),
    [personas],
  );

  const pushLog = useCallback(
    (player: PlayerId, text: string) => {
      const entry: LogEntry = { id: ++logId.current, player, text: personalise(text, personas) };
      setLog((l) => [...l.slice(-49), entry]);
      announce(entry.text);
    },
    [personas],
  );

  const apply = useCallback(
    (prev: S, player: PlayerId, move: M): S => {
      const text = engine.describeMove(prev, player, move);
      const next = engine.applyMove(prev, move);
      pushLog(player, text);
      playSound('card');
      return next;
    },
    [engine, pushLog],
  );

  const reject = useCallback((reason: string, sound: boolean): MoveCheck => {
    setLastError(reason);
    setErrorSeq((n) => n + 1);
    if (sound) playSound('error');
    return { ok: false, reason };
  }, []);

  const attempt = useCallback(
    (move: M): MoveCheck => {
      if (paused || over || current !== HUMAN) {
        const reason = over
          ? t('play.controller.over')
          : paused
            ? t('play.controller.paused')
            : t('play.controller.wait', { name: nameOf(current ?? HUMAN) });
        return reject(reason, false);
      }
      const check = engine.checkMove(state, HUMAN, move);
      if (!check.ok) {
        return reject(personalise(check.reason ?? t('play.controller.illegal'), personas), true);
      }
      setLastError(null);
      setSuggestedKey(null);
      setState(apply(state, HUMAN, move));
      return check;
    },
    [paused, over, current, engine, state, apply, nameOf, reject, personas],
  );

  // Bot turns.
  useEffect(() => {
    if (paused || over || current === null || current === HUMAN) return;
    const player = current;
    const options = engine.legalMoves(state, player);
    const delay = options.length <= 1 ? Math.round(botDelayMs * 0.6) : botDelayMs;
    const timer = setTimeout(() => {
      let move: M | undefined;
      try {
        move = engine.botMove(state, player, difficulty, botRng.current);
      } catch (err) {
        // A broken bot must never freeze the table: fall back to its first legal move.
        console.error('Bot move failed; falling back to a legal move', err);
        move = options[0];
      }
      if (move === undefined) return;
      try {
        setState(apply(state, player, move));
      } catch (err) {
        console.error('Bot move could not be applied', err);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [paused, over, current, state, engine, difficulty, botDelayMs, apply]);

  // Game over callback (once per game).
  useEffect(() => {
    if (over && result && !overFired.current) {
      overFired.current = true;
      onOverRef.current?.(result, state);
    }
  }, [over, result, state]);

  const restart = useCallback(
    (nextSeed?: number | string) => {
      const s = nextSeed ?? seed;
      setSeed(s);
      botRng.current = createRng(`bot-${String(s)}`);
      overFired.current = false;
      setLog([]);
      setLastError(null);
      setSuggestedKey(null);
      setState(engine.setup(config, createRng(s)));
    },
    [seed, engine, config],
  );

  const showHint = useCallback(() => {
    if (!advice || advice.suggestion === undefined) return;
    setSuggestedKey(engine.moveKey(advice.suggestion as M));
  }, [advice, engine]);

  const clearError = useCallback(() => setLastError(null), []);

  return {
    state,
    current,
    legal,
    over,
    result,
    thinking,
    botForced,
    busy: paused || over || current !== HUMAN,
    attempt,
    lastError,
    errorSeq,
    clearError,
    advice,
    showHint,
    suggestedKey,
    highlight,
    log,
    personas,
    restart,
    nameOf,
  };
}
