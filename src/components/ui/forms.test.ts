// @vitest-environment jsdom
import { emailError, focusFirstInvalid, isValidEmail, lengthError, postJson } from './forms';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postJson', () => {
  it('POSTs JSON and returns the parsed body on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await postJson<{ ok: boolean }>('/api/contact', { name: 'Asha' });
    expect(res).toEqual({ ok: true, status: 201, data: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/contact');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{"name":"Asha"}');
  });

  it('normalises the API error shape (string or array field messages)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          error: 'Invalid input',
          fieldErrors: { email: ['Email looks off.', 'second'], title: 'Too short', bad: 3 },
        }),
      ),
    );
    const res = await postJson('/api/posts', {});
    expect(res).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid input',
      fieldErrors: { email: 'Email looks off.', title: 'Too short' },
    });
  });

  it('falls back to friendly messages for non-JSON errors and network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })),
    );
    const bad = await postJson('/api/posts', {});
    expect(bad).toMatchObject({
      ok: false,
      status: 502,
      error: 'Something went wrong. Please try again.',
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const offline = await postJson('/api/posts', {});
    expect(offline).toMatchObject({ ok: false, status: 0 });
    expect(offline.ok ? '' : offline.error).toMatch(/Couldn’t reach the server/);
  });

  it('re-throws aborts so callers can ignore them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
    );
    await expect(postJson('/api/posts', {})).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('validators', () => {
  it('accepts normal addresses and rejects malformed ones', () => {
    for (const ok of ['asha@example.com', 'a.b+cards@mail.co.in', ' trimmed@site.org ']) {
      expect(isValidEmail(ok), ok).toBe(true);
    }
    for (const bad of ['asha@nowhere', 'no-at.example.com', '.dot@x.com', 'a..b@x.com', 'a@b.c']) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });

  it('checks trimmed lengths with friendly messages', () => {
    expect(lengthError('Title', '   ', { min: 3, max: 120 })).toBe('Title is required.');
    expect(lengthError('Name', '', { max: 60, required: false })).toBeNull();
    expect(lengthError('Title', ' Hi ', { min: 3, max: 120 })).toBe(
      'Title needs at least 3 characters.',
    );
    expect(lengthError('Name', 'x'.repeat(61), { max: 60 })).toBe(
      'Name must be 60 characters or fewer.',
    );
    expect(lengthError('Title', 'Uno', { min: 3, max: 120 })).toBeNull();
  });

  it('validates optional and required email fields (≤ 120 chars)', () => {
    expect(emailError('Email', '', { required: false })).toBeNull();
    expect(emailError('Your email', '', { required: true })).toBe('Your email is required.');
    expect(emailError('Email', 'nope', { required: false })).toBe(
      'Please enter a valid email address.',
    );
    expect(emailError('Email', `${'a'.repeat(115)}@x.com`, { required: true })).toBe(
      'Email must be 120 characters or fewer.',
    );
  });
});

describe('focusFirstInvalid', () => {
  it('focuses the first listed field in DOM order', () => {
    const form = document.createElement('form');
    form.innerHTML =
      '<input name="name" /><input name="email" /><textarea name="message"></textarea>';
    document.body.append(form);
    try {
      focusFirstInvalid(form, ['message', 'email']);
      expect(document.activeElement).toBe(form.elements.namedItem('email'));
      focusFirstInvalid(form, []);
      expect(document.activeElement).toBe(form.elements.namedItem('email'));
    } finally {
      form.remove();
    }
  });
});
