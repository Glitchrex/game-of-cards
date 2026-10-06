// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { getTabbable } from './modal';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterEach(() => {
  document.querySelectorAll('[data-test-extra]').forEach((el) => el.remove());
});

function SheetHarness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState<'relaxed' | 'normal' | 'fast'>('normal');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open menu
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Where to next?"
        description="Pick a destination."
        dismissible={dismissible}
      >
        <a href="#games">Games</a>
        {/* A radio group at the very end: Tab from its checked radio must wrap. */}
        <Segmented
          legend="Bot speed"
          value={speed}
          onValueChange={setSpeed}
          options={[
            { value: 'relaxed', label: 'Relaxed' },
            { value: 'normal', label: 'Normal' },
            { value: 'fast', label: 'Fast' },
          ]}
        />
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('is a labelled, described aria-modal dialog that takes focus', async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const sheet = await screen.findByRole('dialog', { name: 'Where to next?' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet).toHaveAccessibleDescription('Pick a destination.');
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
  });

  it('traps Tab, treating a trailing radio group as a single stop', async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const sheet = await screen.findByRole('dialog');
    const close = within(sheet).getByRole('button', { name: 'Close' });
    const checked = within(sheet).getByRole('radio', { name: 'Normal' });

    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(within(sheet).getByRole('link', { name: 'Games' })).toHaveFocus();
    await user.tab();
    expect(checked).toHaveFocus();
    // Last stop in the sheet → wraps back to the first instead of leaving the page.
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(checked).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener; ignores Escape when not dismissible', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SheetHarness />);
    const opener = screen.getByRole('button', { name: 'Open menu' });
    await user.click(opener);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    unmount();

    render(<SheetHarness dismissible={false} />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

function NestedHarness() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuter(true)}>
        Open wallet
      </button>
      <Dialog open={outer} onClose={() => setOuter(false)} title="Wallet">
        <button type="button" onClick={() => setInner(true)}>
          Reset wallet
        </button>
        <Dialog open={inner} onClose={() => setInner(false)} title="Are you sure?" size="sm">
          <button type="button" onClick={() => setInner(false)}>
            Keep my Jeet
          </button>
        </Dialog>
      </Dialog>
    </>
  );
}

describe('modal stack', () => {
  it('makes everything behind the top modal inert, except live regions, and restores it', async () => {
    const user = userEvent.setup();
    const live = document.createElement('div');
    live.setAttribute('aria-live', 'polite');
    live.dataset.testExtra = '';
    const alreadyInert = document.createElement('div');
    alreadyInert.setAttribute('inert', '');
    alreadyInert.dataset.testExtra = '';
    document.body.append(live, alreadyInert);

    const { container } = render(<NestedHarness />);
    await user.click(screen.getByRole('button', { name: 'Open wallet' }));
    const outer = await screen.findByRole('dialog', { name: 'Wallet' });
    const outerRoot = outer.parentElement!;
    expect(outerRoot.parentElement).toBe(document.body);
    expect(container).toHaveAttribute('inert');
    expect(outerRoot).not.toHaveAttribute('inert');
    expect(live).not.toHaveAttribute('inert');

    // Nested: the outer dialog goes inert while the inner one is on top.
    await user.click(within(outer).getByRole('button', { name: 'Reset wallet' }));
    const inner = await screen.findByRole('dialog', { name: 'Are you sure?' });
    expect(outerRoot).toHaveAttribute('inert');
    expect(inner.parentElement).not.toHaveAttribute('inert');

    // Escape closes only the top-most dialog; focus goes back to its opener.
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Are you sure?' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('dialog', { name: 'Wallet' })).toBeInTheDocument();
    expect(outerRoot).not.toHaveAttribute('inert');
    expect(container).toHaveAttribute('inert');
    expect(within(outer).getByRole('button', { name: 'Reset wallet' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(container).not.toHaveAttribute('inert');
    // Someone else's inert is left alone.
    expect(alreadyInert).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Open wallet' })).toHaveFocus();
  });
});

describe('getTabbable', () => {
  it('skips disabled, hidden and negative-tabindex elements and keeps one stop per radio group', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button id="a">A</button>
      <button id="b" disabled tabindex="0">B</button>
      <span id="c" tabindex="-1">C</span>
      <div hidden><button id="d">D</button></div>
      <div aria-hidden="true"><a id="e" href="/x">E</a></div>
      <input id="r1" type="radio" name="speed" value="1" />
      <input id="r2" type="radio" name="speed" value="2" checked />
      <input id="r3" type="radio" name="speed" value="3" />
      <input id="s1" type="radio" name="size" value="s" />
      <input id="s2" type="radio" name="size" value="m" />
      <span id="f" tabindex="0">F</span>
    `;
    document.body.append(root);
    try {
      expect(getTabbable(root).map((el) => el.id)).toEqual(['a', 'r2', 's1', 'f']);
    } finally {
      root.remove();
    }
  });
});
