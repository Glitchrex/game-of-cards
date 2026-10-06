import OpengraphImage, { alt, contentType, size } from '@/app/opengraph-image';
import TwitterImage, * as twitter from '@/app/twitter-image';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('site share images', () => {
  it('declare a 1200×630 PNG with descriptive alt text', () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe('image/png');
    expect(alt).toMatch(/^Game of Cards — Learn every card game\. The fun way\./);
    expect(alt).toMatch(/pretend coins/);
    expect(twitter.size).toEqual(size);
    expect(twitter.contentType).toBe(contentType);
    expect(twitter.alt).toBe(alt);
  });

  it('render a real PNG without any network requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const render of [OpengraphImage, TwitterImage]) {
      const res = render();
      expect(res.headers.get('content-type')).toBe('image/png');
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
      // IHDR width/height (big-endian at bytes 16..23).
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      expect(view.getUint32(16)).toBe(1200);
      expect(view.getUint32(20)).toBe(630);
      expect(bytes.byteLength).toBeGreaterThan(10_000);
    }
    // next/og inlines its wasm as data: URLs; nothing may go out to the network (fonts, emoji).
    const remote = fetchSpy.mock.calls
      .map(([input]) => (input instanceof Request ? input.url : String(input)))
      .filter((url) => !url.startsWith('data:'));
    expect(remote).toEqual([]);
    fetchSpy.mockRestore();
  });
});
