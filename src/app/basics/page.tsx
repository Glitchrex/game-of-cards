import type { Metadata } from 'next';
import { Primer } from '@/components/primer/Primer';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: t('primer.meta.title'),
  description: t('primer.meta.description'),
  alternates: { canonical: '/basics' },
  openGraph: {
    title: t('primer.meta.title'),
    description: t('primer.meta.description'),
    url: '/basics',
  },
};

export default function BasicsPage() {
  return <Primer />;
}
