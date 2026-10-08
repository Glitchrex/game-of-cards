import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';
import { getAllGames } from '@/lib/content/catalog';

// Title, description and Open Graph come from the root layout; this pins the canonical URL.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <LandingPage games={getAllGames()} />;
}
