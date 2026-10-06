// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { type GameModule } from '@/games/core/module';
import { createRng } from '@/games/core/rng';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { titles } from '@content/titles';
import { createShareImage, shareOrDownload } from '@/lib/share-card';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import {
  makeToyModule,
  TOY_CHEAT_REASON,
  TOY_TIPS,
  type ToyOptions,
} from './__fixtures__/toy-game';
import { GameShell, RESULT_REVEAL_MS } from './GameShell';
import { stripTipPrefix } from './personas';
import { clearGameModuleCache } from './useGameModule';

const registry = vi.hoisted(() => ({ module: null as unknown }));

vi.mock('@/games/registry.generated', () => ({
  TIER1_SLUGS: ['toy'],
  ENGINE_SLUGS: ['toy'],
  gameModuleLoaders: {
    toy: () => Promise.resolve(registry.module),
  },
}));

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

const BOT_MS = BOT_DELAY_MS.normal;

function useToy(options: ToyOptions = {}) {
  registry.module = makeToyModule(options) as unknown as GameModule;
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function renderShell(props: Partial<Parameters<typeof GameShell>[0]> = {}) {
  const view = render(
    <>
      <StoreHydrator />
      <GameShell slug="toy" gameName="Toy Duel" tips={TOY_TIPS} {...props} />
      <Toaster />
    </>,
  );
  await flush();
  return view;
}

/** Bet → Deal → play → wait for the bot → wait for the reveal. */
async function playHand(stake = 50) {
  fireEvent.click(screen.getByTestId(`stake-${stake}`));
  fireEvent.click(screen.getByTestId('deal-button'));
  await flush();
  fireEvent.click(screen.getByTestId('move-play'));
  await flush(BOT_MS);
  await flush(RESULT_REVEAL_MS);
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 }))),
  );
  vi.mocked(createShareImage).mockClear();
  vi.mocked(shareOrDownload).mockClear();
  clearGameModuleCache();
  dismissAllToasts();
  localStorage.clear();
  sessionStorage.clear();
  useWallet.setState({ balance: 1000, lastUdhaarAt: null, ledger: [] });
  useStats.getState().reset();
  useProgress.getState().reset();
  useSettings.setState({ botSpeed: 'normal', motion: 'full', muted: true });
  useToy();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GameShell', () => {
  it('shows a felt skeleton, then the bet panel with the opponents', async () => {
    render(
      <>
        <StoreHydrator />
        <GameShell slug="toy" gameName="Toy Duel" tips={TOY_TIPS} />
      </>,
    );
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
    await flush();
    expect(screen.getByTestId('bet-panel')).toBeInTheDocument();
    expect(screen.getByText('You vs Mona')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mona' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the Toy Duel rules' })).toHaveAttribute(
      'href',
      '/games/toy/learn',
    );
  });

  it('says "Just you and the deck" for a solitaire game with no bots', async () => {
    registry.module = { ...makeToyModule(), bots: [] } as unknown as GameModule;
    await renderShell();
    expect(screen.getByText('Just you and the deck')).toBeInTheDocument();
    expect(screen.queryByText(/^You vs/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    expect(
      within(screen.getByTestId('play-table')).getByText('Just you and the deck'),
    ).toBeVisible();
  });

  it('escrows stake × maxLossUnits on Deal and tells the engine what else is affordable', async () => {
    await renderShell();
    fireEvent.click(screen.getByTestId('stake-50'));
    expect(screen.getByTestId('bet-escrow')).toHaveTextContent(
      'We’ll set aside 200 Jeet — the most you could lose — and return what you don’t lose.',
    );
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();

    expect(useWallet.getState().balance).toBe(800);
    expect(useWallet.getState().ledger[0]).toMatchObject({
      amount: -200,
      reason: 'bet',
      gameSlug: 'toy',
    });
    expect(screen.getByTestId('play-table')).toBeInTheDocument();
    // affordableUnits = floor(800 / 50)
    expect(screen.getByTestId('toy-affordable')).toHaveTextContent('16');
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
  });

  it('offers an optional coach during play with hints and "Play it for me"', async () => {
    await renderShell();
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    const toggle = screen.getByTestId('coach-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('coach-panel')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('coach-panel')).toBeInTheDocument();
    // Coach mode makes legal moves glow, exactly like practice.
    expect(screen.getByTestId('move-play')).toHaveAttribute('data-highlighted');
    fireEvent.click(screen.getByTestId('coach-hint'));
    expect(screen.getByTestId('coach-hint-text')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('coach-autoplay'));
    await flush(BOT_MS);
    await flush(RESULT_REVEAL_MS);
    // The coached move still plays for real Jeet: the hand settles normally.
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
  });

  it('runs the bot turn only after the thinking delay', async () => {
    await renderShell();
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    fireEvent.click(screen.getByTestId('move-play'));
    await flush();

    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Mona is thinking…');
    expect(screen.getByTestId('toy-seat')).toHaveAttribute('data-thinking');
    await flush(BOT_MS - 50);
    expect(screen.getByTestId('bot-plays')).toHaveTextContent('0');
    await flush(50);
    expect(screen.getByTestId('bot-plays')).toHaveTextContent('1');
    expect(within(screen.getByTestId('move-log')).getByText('Mona replies.')).toBeInTheDocument();
  });

  it('paces the bot by the bot-speed setting', async () => {
    useSettings.setState({ botSpeed: 'relaxed' });
    await renderShell();
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    fireEvent.click(screen.getByTestId('move-play'));
    await flush(BOT_DELAY_MS.normal);
    expect(screen.getByTestId('bot-plays')).toHaveTextContent('0');
    await flush(BOT_DELAY_MS.relaxed - BOT_DELAY_MS.normal);
    expect(screen.getByTestId('bot-plays')).toHaveTextContent('1');
  });

  it('cancels the bot turn and the result reveal when the table unmounts', async () => {
    const error = vi.spyOn(console, 'error');
    const view = await renderShell();
    fireEvent.click(screen.getByTestId('stake-50'));
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    fireEvent.click(screen.getByTestId('move-play'));
    await flush(BOT_MS / 2);
    view.unmount();
    await flush(BOT_MS + RESULT_REVEAL_MS);
    // The abandoned pot-game hand forfeits its escrow and is never settled as a game.
    expect(useWallet.getState().balance).toBe(800);
    expect(useStats.getState().played).toBe(0);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('explains illegal moves in a callout instead of applying them', async () => {
    await renderShell();
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();

    fireEvent.click(screen.getByTestId('move-cheat'));
    expect(screen.getByTestId('move-error')).toHaveTextContent(TOY_CHEAT_REASON);
    expect(screen.getByRole('alert')).toHaveTextContent(TOY_CHEAT_REASON);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');

    // Moving while the bot thinks is explained too.
    fireEvent.click(screen.getByTestId('move-play'));
    expect(screen.queryByTestId('move-error')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('move-pass'));
    expect(screen.getByTestId('move-error')).toHaveTextContent('Hold on — it’s Mona’s turn.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('move-error')).not.toBeInTheDocument();
  });

  it('settles a win: credits the wallet, records stats + an award, and celebrates', async () => {
    await renderShell();
    await playHand(50);

    // escrow 200 back + 50 winnings
    expect(useWallet.getState().balance).toBe(1050);
    expect(useWallet.getState().ledger[0]).toMatchObject({ amount: 250, reason: 'payout' });
    const stats = useStats.getState();
    expect(stats).toMatchObject({ played: 1, wins: 1, losses: 0, biggestWin: 50 });
    expect(stats.awards).toHaveLength(1);
    expect(stats.awards[0]).toMatchObject({ gameSlug: 'toy', jeet: 50 });
    expect(stats.lastTitleId).toBe(stats.awards[0]?.titleId);
    expect(useProgress.getState().games.toy?.wins).toBe(1);

    const dialog = screen.getByTestId('celebration');
    expect(dialog).toHaveAttribute('role', 'dialog');
    const title = screen.getByTestId('win-title');
    expect(title).toHaveTextContent(stats.awards[0]?.text ?? '');
    // First win ever → a firstWin title.
    expect(titles.find((x) => x.id === stats.lastTitleId)?.when).toContain('firstWin');
    expect(within(dialog).getByText('Game of Cards presents')).toBeInTheDocument();
    expect(within(dialog).getByText('+50 Jeet')).toBeInTheDocument();
    expect(within(dialog).getByText('Award #1 added to your shelf')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Awards shelf' })).toHaveAttribute(
      'href',
      '/stats',
    );
    expect(screen.getByTestId('play-again')).toHaveFocus();
    expect(within(dialog).getByTestId('rating-prompt')).toBeInTheDocument();
  });

  it('shares the win poster and confirms with a toast', async () => {
    await renderShell();
    await playHand(50);
    const award = useStats.getState().awards[0];

    fireEvent.click(screen.getByTestId('share-button'));
    await flush();
    expect(createShareImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createShareImage).mock.calls[0]?.[0]).toMatchObject({
      title: award?.text,
      film: award?.film,
      gameName: 'Toy Duel',
      jeet: 50,
    });
    expect(shareOrDownload).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shareOrDownload).mock.calls[0]?.[1]).toMatch(/^game-of-cards-.+\.png$/);
    expect(screen.getByTestId('toast')).toHaveTextContent('Poster saved — go show it off!');
  });

  it('roasts a loss with a tip, and Rematch returns to the bet with the stake preselected', async () => {
    useToy({ outcome: 'loss' });
    await renderShell();
    await playHand(100);

    // escrow 400 − 100 lost → 300 back
    expect(useWallet.getState().balance).toBe(900);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1, wins: 0 });
    expect(useStats.getState().awards).toHaveLength(0);
    expect(useStats.getState().lastRoastId).not.toBeNull();

    const roast = screen.getByTestId('roast');
    expect(screen.getByTestId('roast-text').textContent).not.toBe('');
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(TOY_TIPS.some((x) => tip.includes(stripTipPrefix(x)))).toBe(true);
    expect(within(roast).getByText('−100 Jeet')).toBeInTheDocument();
    expect(within(roast).getByRole('link', { name: 'Review the rules' })).toHaveAttribute(
      'href',
      '/games/toy/learn',
    );

    fireEvent.click(screen.getByTestId('rematch-button'));
    await flush();
    expect(screen.queryByTestId('roast')).not.toBeInTheDocument();
    expect(screen.getByTestId('bet-panel')).toBeInTheDocument();
    expect(screen.getByTestId('stake-100')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('deal-button')).toHaveFocus();
  });

  it('rotates tips across losses', async () => {
    useToy({ outcome: 'loss' });
    await renderShell();
    await playHand(10);
    const first = screen.getByTestId('roast-tip').textContent;
    fireEvent.click(screen.getByTestId('rematch-button'));
    await flush();
    await playHand(10);
    expect(screen.getByTestId('roast-tip').textContent).not.toBe(first);
  });

  it('debits the extra when a loss exceeds the escrow (doubles / splits)', async () => {
    useToy({ outcome: 'loss', net: 6 });
    await renderShell();
    await playHand(50);
    // escrow 200, lost 300 → 100 more debited
    expect(useWallet.getState().balance).toBe(700);
    expect(useWallet.getState().ledger[0]).toMatchObject({ amount: -100, reason: 'bet' });
  });

  it('handles a push calmly and returns the whole bet', async () => {
    useToy({ outcome: 'push' });
    await renderShell();
    await playHand(50);
    expect(useWallet.getState().balance).toBe(1000);
    expect(useStats.getState()).toMatchObject({ played: 1, pushes: 1 });
    expect(screen.getByTestId('push-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('push-title')).toHaveTextContent('It’s a push — your Jeet is back');
    fireEvent.click(screen.getByTestId('play-again'));
    await flush();
    expect(screen.getByTestId('bet-panel')).toBeInTheDocument();
  });

  it('closing the overlay leaves the final table with Play again / Show result', async () => {
    await renderShell();
    await playHand(50);
    fireEvent.keyDown(screen.getByTestId('celebration'), { key: 'Escape' });
    await flush();
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    expect(screen.getByTestId('hand-over')).toHaveTextContent(
      'You out-played Mona in the toy duel.',
    );
    // Keyboard users continue from the hand-over bar, not from a spent action button.
    expect(screen.getByTestId('play-again-bar')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Show result' }));
    await flush();
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(screen.getByTestId('play-again')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('celebration'), { key: 'Escape' });
    await flush();
    expect(screen.getByTestId('play-again-bar')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Show result' }));
    await flush();
    fireEvent.click(screen.getByTestId('play-again'));
    await flush();
    expect(screen.getByTestId('bet-panel')).toBeInTheDocument();
    // Settled exactly once.
    expect(useWallet.getState().balance).toBe(1050);
  });

  it('forfeits the whole escrow exactly once when the learner leaves a pot game mid-hand', async () => {
    const view = await renderShell();
    fireEvent.click(screen.getByTestId('stake-50'));
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    expect(useWallet.getState().balance).toBe(800);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    // Leaving counts as folding: no refund, so walking away is never cheaper than folding.
    expect(useWallet.getState().balance).toBe(800);
    expect(useWallet.getState().ledger[0]).toMatchObject({ amount: -200, reason: 'bet' });
    // Shown again (back/forward cache): the hand is gone and the learner is told why.
    expect(screen.getByTestId('abandon-notice')).toHaveTextContent('(200 Jeet) was forfeited');
    expect(screen.getByTestId('bet-panel')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    view.unmount();
    expect(useWallet.getState().balance).toBe(800);
    expect(useStats.getState().played).toBe(0);
  });

  it('forfeits on unmount (client navigation) but never touches a settled game', async () => {
    const first = await renderShell();
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    expect(useWallet.getState().balance).toBe(960); // stake 10 × 4
    first.unmount();
    expect(useWallet.getState().balance).toBe(960);

    useWallet.setState({ balance: 1000, ledger: [] });
    const second = await renderShell();
    await playHand(50);
    expect(useWallet.getState().balance).toBe(1050);
    second.unmount();
    expect(useWallet.getState().balance).toBe(1050);
  });

  it('reuses a fixed ?seed for every deal, and draws fresh seeds otherwise', async () => {
    const seeded = await renderShell({ seed: '42' });
    const expected = String(createRng('42').int(1_000_000));
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    expect(screen.getByTestId('toy-dealt')).toHaveTextContent(expected);
    fireEvent.click(screen.getByTestId('move-play'));
    await flush(BOT_MS);
    await flush(RESULT_REVEAL_MS);
    fireEvent.click(screen.getByTestId('play-again'));
    await flush();
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    expect(screen.getByTestId('toy-dealt')).toHaveTextContent(expected);
    seeded.unmount();
  });

  it('never shows the same title twice in a row across a winning streak', async () => {
    await renderShell();
    for (let i = 0; i < 6; i++) {
      await playHand(10);
      fireEvent.click(screen.getByTestId('play-again'));
      await flush();
    }
    const ids = useStats
      .getState()
      .awards.map((a) => a.titleId)
      .reverse();
    expect(ids).toHaveLength(6);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    expect(useStats.getState()).toMatchObject({ played: 6, wins: 6, currentStreak: 6 });
    expect(useWallet.getState().balance).toBe(1060);
  });

  it('shows the engine summary in the roast and the push overlay', async () => {
    useToy({ outcome: 'loss' });
    const loss = await renderShell();
    await playHand(10);
    expect(screen.getByTestId('roast-summary')).toHaveTextContent(
      'Mona edged the toy duel this time.',
    );
    expect(screen.getByTestId('roast')).toHaveAccessibleDescription(
      expect.stringContaining('Mona edged the toy duel this time.'),
    );
    loss.unmount();

    useToy({ outcome: 'push' });
    clearGameModuleCache();
    await renderShell();
    await playHand(10);
    expect(screen.getByTestId('push-summary')).toHaveTextContent('The toy duel ended level.');
  });

  it('sends the rating once, even when the result is closed and reopened', async () => {
    await renderShell();
    await playHand(10);
    const ratings = () =>
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === '/api/ratings');

    fireEvent.click(screen.getByRole('radio', { name: '4 out of 5 stars' }));
    fireEvent.keyDown(screen.getByTestId('celebration'), { key: 'Escape' });
    await flush();
    // Leaving the prompt with stars picked sends them (once).
    expect(ratings()).toHaveLength(1);
    expect(JSON.parse(String(ratings()[0]?.[1]?.body))).toEqual({ gameSlug: 'toy', stars: 4 });

    fireEvent.click(screen.getByRole('button', { name: 'Show result' }));
    await flush();
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(screen.queryByTestId('rating-prompt')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('play-again'));
    await flush();
    await playHand(10);
    expect(screen.queryByTestId('rating-prompt')).not.toBeInTheDocument();
    expect(ratings()).toHaveLength(1);
  });

  it('says the whole bet was forfeited when only the stake was set aside', async () => {
    useToy({ maxLossUnits: 1 });
    const view = await renderShell();
    fireEvent.click(screen.getByTestId('stake-50'));
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    expect(useWallet.getState().balance).toBe(950);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(useWallet.getState().balance).toBe(950);
    expect(screen.getByTestId('abandon-notice')).toHaveTextContent(
      'You left in the middle of a hand, so your 50 Jeet bet was forfeited.',
    );
    view.unmount();
    expect(useWallet.getState().ledger).toHaveLength(1);
  });

  it('tells the learner with a toast when they navigate away mid-hand', async () => {
    const view = await renderShell();
    fireEvent.click(screen.getByTestId('stake-50'));
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    view.unmount();
    expect(useWallet.getState().balance).toBe(800);
    render(<Toaster />);
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'everything you set aside (200 Jeet) was forfeited',
    );
  });

  it('never leaves the wallet negative if the balance shrank before an extra debit', async () => {
    useToy({ outcome: 'loss', net: 6 });
    await renderShell();
    fireEvent.click(screen.getByTestId('stake-50'));
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    // Another tab spent most of the remaining Jeet while this hand was being played.
    act(() => {
      useWallet.setState({ balance: 40 });
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByTestId('move-play'));
    await flush(BOT_MS);
    // Owed 100 more; 40 was all there was.
    expect(useWallet.getState().balance).toBe(0);
    expect(useWallet.getState().ledger[0]).toMatchObject({ amount: -40, reason: 'bet' });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('preselects ?difficulty and offers the Udhaar when nothing is affordable', async () => {
    useWallet.setState({ balance: 30 });
    await renderShell({ difficulty: 'easy' });
    expect(screen.getByRole('radio', { name: 'Easy' })).toBeChecked();
    expect(screen.getByTestId('deal-button')).toBeDisabled();
    expect(screen.getByTestId('udhaar-offer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Claim 500 Jeet' }));
    expect(useWallet.getState().balance).toBe(530);
    expect(screen.getByTestId('deal-button')).toBeEnabled();
  });
});
