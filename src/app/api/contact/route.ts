/** POST /api/contact — contact form message (read in /admin). See docs/API.md. */
import { createContactMessage } from '@/server/repo';
import { writeRateLimit } from '@/server/security';
import { cleanBlock, cleanLine, handle, json, publicWrite } from '@/server/http';
import { contactSchema } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle('POST /api/contact', () =>
    publicWrite(req, {
      bucket: 'write',
      limit: writeRateLimit(),
      honeypot: () => ({ ok: true }),
      schema: contactSchema,
      sanitize: (data) => ({
        ...data,
        name: cleanLine(data.name),
        message: cleanBlock(data.message),
      }),
      persist: async (data, { ipHash }) => {
        await createContactMessage({
          name: data.name,
          email: data.email,
          message: data.message,
          ipHash,
        });
        return json({ ok: true }, 201);
      },
    }),
  );
}
