import { ShieldNoticeIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';

/** Shown when the server has no ADMIN_PASSWORD (every admin endpoint answers 503). */
export function AdminDisabled() {
  return (
    <section
      aria-labelledby="admin-disabled-heading"
      className="panel relative mx-auto max-w-xl overflow-hidden p-6 sm:p-8"
      data-testid="admin-disabled"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="border-gold-300/40 bg-felt-950/60 text-gold-200 inline-flex size-12 shrink-0 items-center justify-center rounded-xl border"
        >
          <ShieldNoticeIcon size={24} />
        </span>
        <div className="min-w-0">
          <h2
            id="admin-disabled-heading"
            className="font-display text-gold-100 text-2xl leading-tight font-bold"
          >
            {t('admin.disabled.title')}
          </h2>
          <p className="text-mist mt-2 leading-relaxed">{t('admin.disabled.body')}</p>
          <p className="text-cream mt-3 leading-relaxed">{t('admin.disabled.how')}</p>
        </div>
      </div>
      <figure className="mt-5">
        <figcaption className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.22em] uppercase">
          {t('admin.disabled.exampleLabel')}
        </figcaption>
        <pre className="border-gold-300/25 bg-felt-950/80 text-gold-100 mt-2 overflow-x-auto rounded-xl border px-4 py-3 font-mono text-sm">
          <code>ADMIN_PASSWORD=a-long-random-secret</code>
        </pre>
      </figure>
    </section>
  );
}
