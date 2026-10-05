// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { siteConfig } from '@/config/site';
import { CopyEmailButton } from './CopyEmailButton';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalExec = document.execCommand;

afterEach(() => {
  dismissAllToasts();
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
  document.execCommand = originalExec;
});

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

describe('CopyEmailButton', () => {
  it('writes the creator email to the clipboard and shows a toast', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(
      <>
        <CopyEmailButton />
        <Toaster />
      </>,
    );
    setClipboard({ writeText });
    const button = screen.getByTestId('copy-email');
    expect(button).toHaveAccessibleName('Copy email');
    await user.click(button);

    expect(writeText).toHaveBeenCalledWith(siteConfig.creator.email);
    expect(await screen.findByTestId('toast')).toHaveTextContent('Email copied!');
    expect(button).toHaveTextContent('Copied!');
  });

  it('falls back to execCommand("copy") when the Clipboard API is unavailable', async () => {
    const user = userEvent.setup();
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    render(
      <>
        <CopyEmailButton />
        <Toaster />
      </>,
    );
    setClipboard(undefined);
    const button = screen.getByTestId('copy-email');
    await user.click(button);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(await screen.findByTestId('toast')).toHaveTextContent('Email copied!');
    // The temporary textarea is cleaned up and focus returns to the button.
    expect(document.querySelector('textarea')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('shows the address in an error toast if copying is impossible', async () => {
    const user = userEvent.setup();
    document.execCommand = vi.fn().mockReturnValue(false);
    render(
      <>
        <CopyEmailButton />
        <Toaster />
      </>,
    );
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    await user.click(screen.getByTestId('copy-email'));
    expect(await screen.findByTestId('toast')).toHaveTextContent(siteConfig.creator.email);
  });
});
