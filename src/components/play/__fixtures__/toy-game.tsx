/**
 * TEST FIXTURE — a tiny fake GameModule ("Toy Duel") used to test the play shell and
 * the practice hand independently of the real games. The learner plays (or passes),
 * the bot replies, and after `rounds` replies the game ends with the configured outcome.
 */
import { type BoardProps, type BotPersona, type GameModule } from '@/games/core/module';
import { type GameEngine, type GameResult } from '@/games/core/types';
import { Seat } from '../Seat';

export interface ToyState {
  turn: 0 | 1;
  over: boolean;
  humanPlays: number;
  botPlays: number;
  rounds: number;
  outcome: GameResult['humanOutcome'];
  net: number;
  affordableUnits: number | null;
  /** A number drawn from the seeded RNG at setup (proves which seed was used). */
  dealt: number;
}

export type ToyMove =
  { kind: 'play' } | { kind: 'pass' } | { kind: 'cheat' } | { kind: 'reply' } | { kind: 'shrug' };

export const TOY_CHEAT_REASON = 'Peeking at the deck is against the rules — play or pass instead.';
export const TOY_INTRO = 'Welcome to the toy table! Press Play to begin.';
export const TOY_SITUATION = 'Your move: play or pass.';
export const TOY_WHY = 'Playing keeps the pressure on Player 1.';

export const MONA: BotPersona = {
  name: 'Mona',
  tagline: 'Never blinks first.',
  avatar: { bg: '#13593d', skin: '#e0ac69', accessory: 'shades', accent: '#f5d77a' },
};

const SUMMARY: Record<GameResult['humanOutcome'], string> = {
  win: 'You out-played Mona in the toy duel.',
  loss: 'Mona edged the toy duel this time.',
  push: 'The toy duel ended level.',
};

export const toyEngine: GameEngine<ToyState, ToyMove> = {
  id: 'toy',
  setup(config, rng) {
    const opts = config.options ?? {};
    return {
      turn: 0,
      over: false,
      humanPlays: 0,
      botPlays: 0,
      rounds: typeof opts.rounds === 'number' ? opts.rounds : 1,
      outcome: (opts.outcome as ToyState['outcome'] | undefined) ?? 'win',
      net: typeof opts.net === 'number' ? opts.net : 1,
      affordableUnits: config.affordableUnits ?? null,
      dealt: rng.int(1_000_000),
    };
  },
  currentPlayer: (s) => (s.over ? null : s.turn),
  legalMoves(s, p) {
    if (s.over || p !== s.turn) return [];
    return p === 0 ? [{ kind: 'play' }, { kind: 'pass' }] : [{ kind: 'reply' }, { kind: 'shrug' }];
  },
  checkMove(s, p, move) {
    if (s.over) return { ok: false, reason: 'The duel is over.' };
    if (p !== s.turn) return { ok: false, reason: 'Wait for your turn.' };
    if (move.kind === 'cheat') return { ok: false, reason: TOY_CHEAT_REASON };
    const legal = p === 0 ? ['play', 'pass'] : ['reply', 'shrug'];
    return legal.includes(move.kind) ? { ok: true } : { ok: false, reason: 'Not a toy move.' };
  },
  applyMove(s, move) {
    if (s.turn === 0)
      return { ...s, turn: 1, humanPlays: s.humanPlays + (move.kind === 'play' ? 1 : 0) };
    const botPlays = s.botPlays + 1;
    return { ...s, botPlays, turn: 0, over: botPlays >= s.rounds };
  },
  isOver: (s) => s.over,
  result(s) {
    const humanNetUnits = s.outcome === 'win' ? s.net : s.outcome === 'loss' ? -s.net : 0;
    return {
      winners: s.outcome === 'win' ? [0] : s.outcome === 'loss' ? [1] : [],
      humanOutcome: s.outcome,
      humanNetUnits,
      summary: SUMMARY[s.outcome],
      flags: {},
    };
  },
  botMove: () => ({ kind: 'reply' }),
  describeMove: (_s, p, move) => (p === 0 ? `You ${move.kind}.` : `Player ${p} replies.`),
  coach: (s) =>
    s.turn === 0
      ? { situation: TOY_SITUATION, suggestion: { kind: 'play' }, why: TOY_WHY }
      : { situation: 'Waiting for Player 1.' },
  moveKey: (m) => m.kind,
};

export function ToyBoard({
  state,
  onMove,
  thinking,
  highlight,
  suggestedKey,
  personas,
  over,
}: BoardProps<ToyState, ToyMove>) {
  return (
    <div data-testid="toy-board" data-over={over || undefined}>
      <Seat
        persona={personas[1]}
        active={state.turn === 1 && !over}
        thinking={thinking === 1}
        data-testid="toy-seat"
      >
        <p data-testid="bot-plays">{state.botPlays}</p>
      </Seat>
      <p data-testid="toy-dealt">{state.dealt}</p>
      <p data-testid="toy-affordable">{String(state.affordableUnits)}</p>
      {(['play', 'pass', 'cheat'] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          data-testid={`move-${kind}`}
          data-highlighted={highlight.has(kind) || undefined}
          data-suggested={suggestedKey === kind || undefined}
          onClick={() => onMove({ kind })}
        >
          {kind}
        </button>
      ))}
    </div>
  );
}

export interface ToyOptions {
  outcome?: GameResult['humanOutcome'];
  net?: number;
  rounds?: number;
  maxLossUnits?: number;
}

export function makeToyModule(o: ToyOptions = {}): GameModule<ToyState, ToyMove> {
  return {
    slug: 'toy',
    engine: toyEngine,
    Board: ToyBoard,
    betting: {
      stakeOptions: [10, 50, 100, 500],
      minStake: 10,
      maxStake: 500,
      maxLossUnits: o.maxLossUnits ?? 4,
      describe: 'Win and your stake comes back doubled.',
    },
    bots: [MONA],
    defaultConfig: {
      players: 2,
      options: { outcome: o.outcome ?? 'win', net: o.net ?? 1, rounds: o.rounds ?? 1 },
    },
    practice: { seed: 7, intro: TOY_INTRO },
  };
}

export const TOY_TIPS = [
  'Tip: count the cards that are already gone.',
  'Tip: passing is sometimes the bravest move.',
  'Tip: watch what the bot does after you pass.',
];
