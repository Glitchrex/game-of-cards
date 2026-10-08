import { OG_ALT, OG_SIZE, renderSiteOgImage } from '@/components/landing/og-art';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Site-wide X/Twitter card image — the same poster as the Open Graph image. */
export default function TwitterImage() {
  return renderSiteOgImage();
}
