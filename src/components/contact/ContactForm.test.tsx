// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactForm } from './ContactForm';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ContactForm', () => {
  it('validates required fields, email format and message length before posting', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const name = screen.getByRole('textbox', { name: 'Your name' });
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(/Your name is required/);
    expect(name).toHaveFocus();
    expect(screen.getByText('Your email is required.')).toBeInTheDocument();
    expect(screen.getByText('Message is required.')).toBeInTheDocument();

    await user.type(name, 'Asha');
    await user.type(screen.getByRole('textbox', { name: 'Your email' }), 'asha@nowhere');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Too short');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Message needs at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your email' })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a valid message to /api/contact and shows the success state', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(201, { ok: true }));
    render(<ContactForm />);
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), '  Asha ');
    await user.type(screen.getByRole('textbox', { name: 'Your email' }), 'asha@example.com');
    await user.type(
      screen.getByRole('textbox', { name: 'Message' }),
      'Please add Mendikot to the games list!',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      await screen.findByRole('heading', { name: "Message sent! I'll get back to you soon." }),
    ).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/contact');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Asha',
      email: 'asha@example.com',
      message: 'Please add Mendikot to the games list!',
      website: '',
    });

    await user.click(screen.getByRole('button', { name: 'Send another message' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveFocus());
    expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveValue('');
  });

  it('shows the server error (e.g. rate limit) and field errors', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, {
        error: 'Too many requests — take a breather and try again in a minute.',
      }),
    );
    render(<ContactForm />);
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Asha');
    await user.type(screen.getByRole('textbox', { name: 'Your email' }), 'asha@example.com');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Hello from the table!');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests — take a breather and try again in a minute.',
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: 'Invalid input', fieldErrors: { email: 'Email looks off.' } }),
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Email looks off.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid input');
    // Focus lands on the field the server rejected, with its error already in the description.
    const email = screen.getByRole('textbox', { name: 'Your email' });
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAccessibleDescription(/Email looks off\./);
    expect(email).toHaveAttribute('aria-invalid', 'true');
  });

  it('reports network failures in plain words', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<ContactForm />);
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Asha');
    await user.type(screen.getByRole('textbox', { name: 'Your email' }), 'asha@example.com');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Hello from the table!');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn’t reach the server/);
  });

  it('keeps the honeypot out of the tab order and the accessibility tree', () => {
    render(<ContactForm />);
    const honeypot = screen.getByTestId('contact-honeypot');
    expect(honeypot).toHaveAttribute('name', 'website');
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('textbox', { name: /website/i })).not.toBeInTheDocument();
  });
});
