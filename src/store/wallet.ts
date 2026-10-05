'use client';
/**
 * Jeet wallet — pretend money for learning. It can never be bought, sold,
 * withdrawn or exchanged. Persisted in localStorage under "goc:wallet".
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const STARTING_BALANCE = 1000;
export const UDHAAR_AMOUNT = 500;
export const UDHAAR_THRESHOLD = 100;
export const UDHAAR_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface LedgerEntry {
  at: number;
  /** Positive = credit, negative = debit. */
  amount: number;
  reason: 'bet' | 'payout' | 'refund' | 'udhaar';
  gameSlug?: string;
}

export interface WalletState {
  balance: number;
  lastUdhaarAt: number | null;
  ledger: LedgerEntry[];
  /** Take `amount` from the wallet for a bet. Returns false if it can't be covered. */
  placeBet: (amount: number, gameSlug: string) => boolean;
  /** Credit a payout (stake returned + winnings). */
  credit: (amount: number, gameSlug: string, reason?: 'payout' | 'refund') => void;
  /** Claim the Daily Udhaar refill. Returns false if not eligible. */
  claimUdhaar: (now?: number) => boolean;
  reset: () => void;
}

export function udhaarStatus(
  balance: number,
  lastUdhaarAt: number | null,
  now: number,
): { eligible: boolean; reason: 'ok' | 'not-broke' | 'cooldown'; msUntilNext: number } {
  if (balance >= UDHAAR_THRESHOLD) return { eligible: false, reason: 'not-broke', msUntilNext: 0 };
  if (lastUdhaarAt !== null && now - lastUdhaarAt < UDHAAR_COOLDOWN_MS) {
    return {
      eligible: false,
      reason: 'cooldown',
      msUntilNext: UDHAAR_COOLDOWN_MS - (now - lastUdhaarAt),
    };
  }
  return { eligible: true, reason: 'ok', msUntilNext: 0 };
}

const MAX_LEDGER = 50;
const pushLedger = (ledger: LedgerEntry[], e: LedgerEntry) => [e, ...ledger].slice(0, MAX_LEDGER);

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: STARTING_BALANCE,
      lastUdhaarAt: null,
      ledger: [],
      placeBet: (amount, gameSlug) => {
        const amt = Math.round(amount);
        if (!Number.isFinite(amt) || amt <= 0 || amt > get().balance) return false;
        set((s) => ({
          balance: s.balance - amt,
          ledger: pushLedger(s.ledger, { at: Date.now(), amount: -amt, reason: 'bet', gameSlug }),
        }));
        return true;
      },
      credit: (amount, gameSlug, reason = 'payout') => {
        const amt = Math.round(amount);
        if (!Number.isFinite(amt) || amt <= 0) return;
        set((s) => ({
          balance: s.balance + amt,
          ledger: pushLedger(s.ledger, { at: Date.now(), amount: amt, reason, gameSlug }),
        }));
      },
      claimUdhaar: (now = Date.now()) => {
        const { balance, lastUdhaarAt } = get();
        if (!udhaarStatus(balance, lastUdhaarAt, now).eligible) return false;
        set((s) => ({
          balance: s.balance + UDHAAR_AMOUNT,
          lastUdhaarAt: now,
          ledger: pushLedger(s.ledger, { at: now, amount: UDHAAR_AMOUNT, reason: 'udhaar' }),
        }));
        return true;
      },
      reset: () => set({ balance: STARTING_BALANCE, lastUdhaarAt: null, ledger: [] }),
    }),
    {
      name: 'goc:wallet',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ balance: s.balance, lastUdhaarAt: s.lastUdhaarAt, ledger: s.ledger }),
    },
  ),
);
