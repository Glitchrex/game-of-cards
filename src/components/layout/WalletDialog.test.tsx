// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { StoreHydrator } from '@/store/hydrate';
import { UDHAAR_COOLDOWN_MS, useWallet } from '@/store/wallet';
import { formatCooldown, UdhaarOffer } from './UdhaarOffer';
import { WalletDialog } from './WalletDialog';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  dismissAllToasts();
  localStorage.clear();
  useWallet.setState({ balance: 1000, lastUdhaarAt: null, ledger: [] });
});

function renderDialog() {
  return render(
    <>
      <StoreHydrator />
      <WalletDialog open onClose={() => {}} />
      <Toaster />
    </>,
  );
}

describe('WalletDialog', () => {
  it('shows balance, the notice and an empty ledger message', async () => {
    renderDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Your Jeet wallet' });
    expect(within(dialog).getAllByText('1,000').length).toBeGreaterThan(0);
    expect(
      within(dialog).getByText('Jeet is pretend money for learning. No real money, ever.'),
    ).toBeInTheDocument();
    expect(await within(dialog).findByTestId('udhaar-offer')).toHaveAttribute(
      'data-state',
      'not-broke',
    );
    expect(
      within(dialog).getByText(/unlocks when your balance drops below 100 Jeet/),
    ).toBeVisible();
    expect(within(dialog).getByText(/No bets yet/)).toBeInTheDocument();
  });

  it('lets a broke learner claim the Daily Udhaar once, with a toast', async () => {
    const user = userEvent.setup();
    useWallet.setState({ balance: 50 });
    renderDialog();
    expect(
      await screen.findByText(
        "Paisa khatam? Take a 500 Jeet udhaar — we won't send recovery agents.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Claim 500 Jeet' }));

    expect(useWallet.getState().balance).toBe(550);
    expect(useWallet.getState().ledger[0]).toMatchObject({ amount: 500, reason: 'udhaar' });
    expect(await screen.findByTestId('toast')).toHaveTextContent('Udhaar granted! +500 Jeet');
    expect(screen.queryByRole('button', { name: 'Claim 500 Jeet' })).not.toBeInTheDocument();
    // The claim button is gone: focus stays inside the dialog, on the offer, not on <body>.
    expect(screen.getByTestId('udhaar-offer')).toHaveFocus();
    // Back above the threshold: the offer explains when it unlocks again.
    expect(screen.getByTestId('udhaar-offer')).toHaveAttribute('data-state', 'not-broke');
    expect(screen.getByRole('heading', { name: 'Daily Udhaar' })).toBeInTheDocument();
  });

  it('respects the 24 h cooldown and shows the time remaining', async () => {
    const user = userEvent.setup();
    useWallet.setState({ balance: 50 });
    renderDialog();
    await user.click(await screen.findByRole('button', { name: 'Claim 500 Jeet' }));

    // Lose it all again straight away.
    act(() => {
      useWallet.setState({ balance: 20 });
    });
    const offer = screen.getByTestId('udhaar-offer');
    expect(offer).toHaveAttribute('data-state', 'cooldown');
    expect(within(offer).getByText(/^Next udhaar in \d+h \d+m$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claim 500 Jeet' })).not.toBeInTheDocument();
    expect(useWallet.getState().claimUdhaar()).toBe(false);
    expect(useWallet.getState().balance).toBe(20);
  });

  it('lists recent ledger entries with signed amounts', async () => {
    useWallet.setState({
      ledger: [
        { at: Date.now() - 5 * 60_000, amount: 240, reason: 'payout', gameSlug: 'teen-patti' },
        { at: Date.now() - 6 * 60_000, amount: -120, reason: 'bet', gameSlug: 'teen-patti' },
      ],
    });
    renderDialog();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Winnings')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/Teen Patti/)).toHaveLength(2);
    expect(within(dialog).getByText('+240')).toBeInTheDocument();
    expect(within(dialog).getByText('−120')).toBeInTheDocument();
  });
});

describe('UdhaarOffer (compact)', () => {
  it('renders a one-line claim strip for the bet panel', async () => {
    const user = userEvent.setup();
    const onClaimed = vi.fn();
    useWallet.setState({ balance: 0 });
    render(
      <>
        <StoreHydrator />
        <UdhaarOffer compact onClaimed={onClaimed} />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'Claim 500 Jeet' }));
    expect(onClaimed).toHaveBeenCalledTimes(1);
    expect(useWallet.getState().balance).toBe(500);
    expect(screen.getByTestId('udhaar-offer')).toHaveFocus();
  });

  it('lets the caller move focus after a claim', async () => {
    const user = userEvent.setup();
    useWallet.setState({ balance: 10 });
    function BetPanel() {
      return (
        <>
          <UdhaarOffer compact onClaimed={() => document.getElementById('place-bet')?.focus()} />
          <button id="place-bet" type="button">
            Place bet
          </button>
        </>
      );
    }
    render(
      <>
        <StoreHydrator />
        <BetPanel />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'Claim 500 Jeet' }));
    expect(screen.getByRole('button', { name: 'Place bet' })).toHaveFocus();
  });
});

describe('formatCooldown', () => {
  it('formats hours/minutes and short waits', () => {
    expect(formatCooldown(UDHAAR_COOLDOWN_MS)).toBe('24h 0m');
    expect(formatCooldown(5 * 3_600_000 + 12 * 60_000)).toBe('5h 12m');
    expect(formatCooldown(12 * 60_000)).toBe('12m');
    expect(formatCooldown(30_000)).toBe('under a minute');
  });
});
