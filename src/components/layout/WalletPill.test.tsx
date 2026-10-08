// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { StoreHydrator } from '@/store/hydrate';
import { useWallet } from '@/store/wallet';
import { WalletPill } from './WalletPill';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  localStorage.clear();
  useWallet.setState({ balance: 1000, lastUdhaarAt: null, ledger: [] });
});

describe('WalletPill', () => {
  it('shows a skeleton until hydrated, then the balance with an accessible label', async () => {
    render(
      <>
        <StoreHydrator />
        <WalletPill />
      </>,
    );
    // Hydration completes asynchronously, so the very first paint is the skeleton.
    expect(screen.getByTestId('wallet-skeleton')).toBeInTheDocument();
    const pill = await screen.findByRole('button', { name: 'Wallet: 1,000 Jeet' });
    expect(pill).toHaveTextContent('1,000');
    expect(screen.queryByTestId('wallet-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('Udhaar')).not.toBeInTheDocument();
  });

  it('shows the pulsing Udhaar badge when the balance drops below 100', async () => {
    render(
      <>
        <StoreHydrator />
        <WalletPill />
      </>,
    );
    await screen.findByRole('button', { name: 'Wallet: 1,000 Jeet' });
    act(() => {
      useWallet.setState({ balance: 50 });
    });
    const pill = await screen.findByRole('button', {
      name: 'Wallet: 50 Jeet. Daily Udhaar available',
    });
    expect(pill).toHaveTextContent('50');
    expect(screen.getByText('Udhaar')).toBeInTheDocument();
  });

  it('hides the badge while the udhaar is on cooldown', async () => {
    useWallet.setState({ balance: 40, lastUdhaarAt: Date.now() - 60 * 60 * 1000 });
    render(
      <>
        <StoreHydrator />
        <WalletPill />
      </>,
    );
    expect(await screen.findByRole('button', { name: 'Wallet: 40 Jeet' })).toBeInTheDocument();
    expect(screen.queryByText('Udhaar')).not.toBeInTheDocument();
  });

  it('opens the wallet dialog with the pretend-money notice', async () => {
    const user = userEvent.setup();
    render(
      <>
        <StoreHydrator />
        <WalletPill />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'Wallet: 1,000 Jeet' }));
    expect(await screen.findByRole('dialog', { name: 'Your Jeet wallet' })).toBeInTheDocument();
    expect(screen.getByTestId('wallet-notice')).toHaveTextContent(
      'Jeet is pretend money for learning. No real money, ever.',
    );
    expect(screen.queryByRole('button', { name: /buy|purchase|pay/i })).not.toBeInTheDocument();
  });
});
