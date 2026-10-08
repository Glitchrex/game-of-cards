import { OG_ALT, OG_SIZE, renderSiteOgImage } from '@/components/landing/og-art';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Site-wide Open Graph image (pages without their own inherit it). */
export default function OpengraphImage() {
  return renderSiteOgImage();
}
