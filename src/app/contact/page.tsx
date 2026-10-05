import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/contact/ContactForm';
import { CreatorCard } from '@/components/contact/CreatorCard';
import { MailIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: t('contact.meta.title'),
  description: t('contact.meta.description'),
  alternates: { canonical: '/contact' },
  openGraph: {
    title: t('contact.meta.title'),
    description: t('contact.meta.description'),
    url: '/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="relative overflow-hidden">
      {/* spotlight + curtain glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(60%_70%_at_50%_0%,rgb(245_215_122/0.14),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -left-40 h-[30rem] w-80 rotate-12 bg-[radial-gradient(closest-side,rgb(158_32_54/0.3),transparent)] max-md:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -right-40 h-[30rem] w-80 -rotate-12 bg-[radial-gradient(closest-side,rgb(158_32_54/0.3),transparent)] max-md:hidden"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 pt-10 pb-8 sm:px-6 sm:pt-16 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="border-gold-300/40 bg-felt-950/50 text-gold-300 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.24em] uppercase">
            <span aria-hidden="true" className="animate-bulb bg-gold-300 size-1.5 rounded-full" />
            {t('contact.page.eyebrow')}
          </p>
          <h1 className="font-display text-foil mt-4 text-[2.5rem] leading-[1.05] font-black tracking-[-0.02em] sm:text-6xl">
            {t('contact.page.title')}
          </h1>
          <p className="text-mist mt-4 text-base leading-relaxed text-pretty sm:text-lg">
            {t('contact.page.intro')}
          </p>
        </header>

        <div className="mt-10 grid items-start gap-6 lg:mt-14 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
          <CreatorCard />

          <section aria-labelledby="contact-form-heading" className="panel p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="border-gold-300/40 bg-felt-950/60 text-gold-200 inline-flex size-11 shrink-0 items-center justify-center rounded-xl border"
              >
                <MailIcon size={22} />
              </span>
              <div>
                <h2
                  id="contact-form-heading"
                  className="font-display text-gold-100 text-2xl leading-tight font-bold sm:text-3xl"
                >
                  {t('contact.page.formHeading')}
                </h2>
                <p className="text-mist mt-1 text-sm">{t('contact.page.formIntro')}</p>
              </div>
            </div>
            <div className="mt-6">
              <ContactForm />
            </div>
            <p className="border-gold-300/15 text-mist mt-6 border-t pt-4 text-sm">
              {t('contact.page.boardNudge')}{' '}
              <Link
                href="/community"
                className="text-gold-200 hover:text-gold-100 font-semibold underline underline-offset-4"
              >
                {t('contact.page.boardLink')}
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
