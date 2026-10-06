// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { type BettingSpec } from '@/games/core/module';
import { StoreHydrator } from '@/store/hydrate';
import { useWallet } from '@/store/wallet';
import { BetPanel, chipLabel, stakeChoices } from './BetPanel';

const betting: BettingSpec = {
  stakeOptions: [10, 50, 100, 500],
  minStake: 10,
  maxStake: 500,
  maxLossUnits: 4,
  describe: 'Beat the dealer to double your bet. Blackjack pays 3 to 2.',
};

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  localStorage.clear();
  useWallet.setState({ balance: 1000, lastUdhaarAt: null, ledger: [] });
});

describe('BetPanel', () => {
  it('explains the bet, disables chips the wallet cannot cover, and deals', async () => {
    const user = userEvent.setup();
    const onDeal = vi.fn();
    render(<BetPanel betting={betting} gameName="Blackjack" balance={1000} onDeal={onDeal} />);

    expect(screen.getByTestId('bet-panel')).toHaveTextContent(betting.describe);
    expect(screen.getByTestId('bet-panel')).toHaveTextContent('In your wallet');
    // 500 × 4 = 2,000 > 1,000
    const big = screen.getByTestId('stake-500');
    expect(big).toBeDisabled();
    expect(big).toHaveAccessibleDescription('Needs 2,000 Jeet set aside');
    expect(screen.getByText(/Greyed-out chips need more Jeet/)).toBeInTheDocument();
    // Smallest affordable chip is preselected.
    expect(screen.getByTestId('stake-10')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('bet-escrow')).toHaveTextContent('We’ll set aside 40 Jeet');

    await user.click(screen.getByTestId('stake-100'));
    expect(screen.getByTestId('stake-100')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('stake-10')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('bet-escrow')).toHaveTextContent(
      'We’ll set aside 400 Jeet — the most you could lose — and return what you don’t lose.',
    );
    expect(screen.getByText('Bet 100 Jeet on Blackjack')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked();

    await user.click(screen.getByTestId('deal-button'));
    expect(onDeal).toHaveBeenLastCalledWith(100, 'normal');
    await user.click(screen.getByRole('radio', { name: 'Easy' }));
    await user.click(screen.getByTestId('deal-button'));
    expect(onDeal).toHaveBeenLastCalledWith(100, 'easy');
  });

  it('preselects the previous stake and difficulty, falling back when no longer affordable', () => {
    const { rerender } = render(
      <BetPanel
        betting={betting}
        gameName="Blackjack"
        balance={1000}
        onDeal={() => {}}
        initialStake={100}
        initialDifficulty="easy"
      />,
    );
    expect(screen.getByTestId('stake-100')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'Easy' })).toBeChecked();
    rerender(
      <BetPanel
        betting={betting}
        gameName="Blackjack"
        balance={300}
        onDeal={() => {}}
        initialStake={100}
      />,
    );
    expect(screen.getByTestId('stake-100')).toBeDisabled();
    expect(screen.getByTestId('stake-50')).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses a simple line when the stake is all that can be lost', () => {
    render(
      <BetPanel
        betting={{ ...betting, maxLossUnits: 1 }}
        gameName="War"
        balance={1000}
        onDeal={() => {}}
        difficulties={['normal']}
      />,
    );
    expect(screen.getByTestId('bet-escrow')).toHaveTextContent('Your 10 Jeet goes on the table.');
    expect(screen.queryByRole('radio', { name: 'Easy' })).not.toBeInTheDocument();
  });

  it('offers the Daily Udhaar when no chip is affordable', async () => {
    useWallet.setState({ balance: 20 });
    render(
      <>
        <StoreHydrator />
        <BetPanel betting={betting} gameName="Blackjack" balance={20} onDeal={() => {}} />
      </>,
    );
    expect(screen.getByTestId('deal-button')).toBeDisabled();
    expect(screen.getByText(/don’t have enough Jeet for the smallest bet/)).toBeInTheDocument();
    expect(await screen.findByTestId('udhaar-offer')).toHaveAttribute('data-state', 'ok');
  });
});

describe('chip helpers', () => {
  it('formats chip faces and filters stake options', () => {
    expect(chipLabel(50)).toBe('50');
    expect(chipLabel(1000)).toBe('1K');
    expect(chipLabel(2500)).toBe('2.5K');
    expect(
      stakeChoices({ ...betting, stakeOptions: [100, 10, 10, 5000, -1], maxStake: 1000 }),
    ).toEqual([10, 100]);
  });
});
