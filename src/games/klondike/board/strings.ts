/**
 * Klondike table chrome (src/games/klondike/Board.tsx): zone labels, selection prompts, the
 * Vegas readout, the action bar and the resign dialog. Game rules, reasons and move
 * descriptions come from the engine; only UI text is here.
 *
 * Same shape as a namespace under src/lib/i18n/en/ (`export const <ns> = { … } as const`),
 * read through the typed `kt('klondike.…')` helper below, which fills `{name}` placeholders
 * exactly like `t()`. It can move to src/lib/i18n/en/klondike.ts (and `kt` become `t`) as
 * soon as the namespace is registered in src/lib/i18n/en/index.ts.
 */
export const klondike = {
  zone: {
    table: 'Klondike table',
    topRow: 'Stock, waste and foundations',
    tableau: 'The seven columns',
    stock: 'Stock — press to draw a card',
    stockRecycle: 'Stock is empty — press to turn the waste over',
    stockEmpty: 'Stock and waste are both empty',
    waste: 'Waste',
    wasteEmpty: 'Waste: empty',
    wasteTop: 'Waste: {card} on top, {count}',
    foundationEmpty: '{suit} foundation: empty — it starts with the Ace of {suit}',
    foundation: '{suit} foundation: {count}, top card {card}',
    column: 'Column {n}',
    columnEmpty: 'Column {n}: empty — only a King can go here',
    columnCards: 'Column {n}: {cards}',
    hidden: '{count} face-down',
    hiddenOne: '1 face-down card',
    hiddenMany: '{count} face-down cards',
    then: '{hidden}, then {cards}',
  },
  select: {
    picked:
      'Picked up {cards}. Now choose a column or a foundation and press Enter. Escape cancels.',
    pickedFromColumn:
      'Picked up {cards} from column {n}. Up and Down arrows change how many cards. Then choose a column or a foundation and press Enter. Escape cancels.',
    holding: 'Holding {cards}.',
    cancelled: 'Put the card back.',
    nothing: 'There is no card here to pick up.',
    emptyColumn: 'Column {n} is empty. Pick up a King first, then choose this column.',
    emptyFoundation:
      'The {suit} foundation is empty. Pick up the Ace of {suit} first, then choose this foundation.',
    selectedHere: 'Selected: {cards}.',
    run: '{first} down to {last}, {count}',
    destination: 'Press Enter to move the selected cards here.',
    toggle: 'Press Enter again to put the cards back.',
  },
  coach: {
    source: 'The coach’s pick: move from here.',
    target: 'The coach’s pick: move here.',
    drawPick: 'The coach’s pick.',
    canMove: 'A card here can move.',
    canDraw: 'You can draw a card here.',
    canRecycle: 'You can turn the waste over here.',
    canReceive: 'The selected cards can go here.',
    pick: 'Pro pick',
  },
  readout: {
    label: 'Your Vegas score',
    home: 'Cards home',
    back: 'Stake back',
    times: '×{n}',
    of: '{home} / 52',
    breakEven: '11 to break even',
    ahead: 'You’re ahead',
    full: 'Cards home: {home} of 52. Stake back: {n} times your stake. {status}',
    statusAhead: 'You are ahead.',
    statusBehind: '{n} more to break even.',
    statusBehindOne: '1 more card to break even.',
    passes: 'Pass {n}',
    hostSays: '{name}: “Every card home, I pay out.”',
  },
  actions: {
    label: 'Table actions',
    draw: 'Draw',
    drawHint: 'Stock → waste',
    recycle: 'Turn over',
    recycleHint: 'Waste → stock',
    home: 'Send home',
    homeHint: 'To a foundation',
    auto: 'Auto-finish',
    autoHint: 'Safe cards home',
    autoAll: 'Finish the game',
    autoNone: 'No card can safely go home right now.',
    autoRunning: 'Sending cards home…',
    resign: 'I’m done',
    resignHint: 'Stop & cash in',
    homeNothing: 'Pick a card (or focus a pile) first, then press Send home.',
    unavailable: 'Not available right now — press it and the coach explains why.',
    wait: 'Wait a moment.',
    over: 'This game is over.',
    keys: 'Keyboard',
    keyMove: 'move between piles',
    keyPick: 'pick up / put down',
    keyDepth: 'more or fewer cards',
    keyHome: 'send home',
    keyDraw: 'draw',
    keyCancel: 'cancel',
  },
  resign: {
    title: 'Stop this game?',
    body: 'You have {home} on the foundations, which pays back {n} times your stake. The game ends here.',
    bodyNone:
      'No card is on a foundation yet, so stopping now loses your stake. The game ends here.',
    confirm: 'Yes, I’m done',
    cancel: 'Keep playing',
  },
  outcome: {
    cleared: 'Cleared!',
    stopped: 'Stopped',
  },
} as const;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** A key of the Klondike dictionary, e.g. `'klondike.zone.stock'`. */
export type KlondikeKey = Leaves<{ klondike: typeof klondike }>;

const PLACEHOLDER_RE = /\{([A-Za-z0-9_]+)\}/g;

/** Translate a Klondike UI key and fill `{name}` placeholders (single pass, like `t()`). */
export function kt(key: KlondikeKey, vars?: Record<string, string | number>): string {
  let node: unknown = { klondike };
  for (const part of key.split('.')) {
    node =
      node !== null && typeof node === 'object' && Object.hasOwn(node, part)
        ? (node as Record<string, unknown>)[part]
        : undefined;
  }
  const out = typeof node === 'string' ? node : key;
  if (!vars) return out;
  return out.replace(PLACEHOLDER_RE, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}
