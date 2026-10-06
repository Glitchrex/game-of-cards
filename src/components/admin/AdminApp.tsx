'use client';
/**
 * /admin entry: asks the server whether admin is enabled and whether this
 * browser is logged in, then shows the "disabled" explainer, the password
 * form or the dashboard.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { adminSession } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { AdminDashboard } from './AdminDashboard';
import { AdminDisabled } from './AdminDisabled';
import { AdminLogin } from './AdminLogin';

export interface AdminAppProps {
  /** slug → game name from the catalog (for the ratings tab). */
  gameNames: Readonly<Record<string, string>>;
}

type Phase =
  | { kind: 'checking' }
  | { kind: 'disabled' }
  | { kind: 'login'; notice: string | null }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

export function AdminApp({ gameNames }: AdminAppProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    void adminSession({ signal: ctrl.signal }).then((res) => {
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        setPhase({ kind: 'error', message: res.error });
      } else if (!res.data.enabled) {
        setPhase({ kind: 'disabled' });
      } else {
        setPhase(res.data.authenticated ? { kind: 'ready' } : { kind: 'login', notice: null });
      }
    });
    return () => ctrl.abort();
  }, [checks]);

  switch (phase.kind) {
    case 'checking':
      return (
        <div className="text-gold-300 flex justify-center py-16" data-testid="admin-checking">
          <Spinner size="lg" label={t('admin.checking')} />
        </div>
      );
    case 'disabled':
      return <AdminDisabled />;
    case 'error':
      return (
        <div
          role="alert"
          className="border-velvet-400/50 bg-velvet-700/35 mx-auto flex max-w-md flex-col items-start gap-3 rounded-2xl border p-5"
        >
          <p className="text-cream flex items-start gap-2 font-semibold">
            <AlertIcon size={20} className="text-velvet-300 mt-0.5 shrink-0" />
            <span>{phase.message}</span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setPhase({ kind: 'checking' });
              setChecks((n) => n + 1);
            }}
          >
            {t('admin.errors.retry')}
          </Button>
        </div>
      );
    case 'login':
      return (
        <AdminLogin
          notice={phase.notice}
          onSuccess={() => setPhase({ kind: 'ready' })}
          onDisabled={() => setPhase({ kind: 'disabled' })}
        />
      );
    case 'ready':
      return (
        <AdminDashboard
          gameNames={gameNames}
          onExpired={() => setPhase({ kind: 'login', notice: t('admin.sessionExpired') })}
          onDisabled={() => setPhase({ kind: 'disabled' })}
          onLoggedOut={() => setPhase({ kind: 'login', notice: null })}
        />
      );
  }
}
