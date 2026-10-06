/**
 * The per-browser voter token (docs/DECISIONS.md D-10) lives in the persisted
 * settings store. Only read it after the stores have hydrated.
 */
import { useSettings } from '@/store/settings';

/** Same rule the API enforces for `voter` / `voterToken`. */
const VOTER_TOKEN = /^[A-Za-z0-9_-]{8,100}$/;

export function isValidVoterToken(token: unknown): token is string {
  return typeof token === 'string' && VOTER_TOKEN.test(token);
}

/**
 * The existing token for read requests (`?voter=`), or null when this browser
 * has never voted. A malformed stored value is ignored rather than sent —
 * the API would reject the whole request.
 */
export function currentVoterToken(): string | null {
  const token = useSettings.getState().voterToken;
  return isValidVoterToken(token) ? token : null;
}

/**
 * The token to vote with, created on first use. A malformed stored value
 * (e.g. edited by hand in devtools) is replaced — the API would answer 400 to
 * every vote otherwise, and the browser could never vote again.
 */
export function ensureVoterToken(): string {
  const settings = useSettings.getState();
  if (settings.voterToken !== null && !isValidVoterToken(settings.voterToken)) {
    useSettings.setState({ voterToken: null });
  }
  return useSettings.getState().ensureVoterToken();
}
