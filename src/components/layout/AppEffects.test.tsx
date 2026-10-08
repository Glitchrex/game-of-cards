// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { playSound, unlockAudio } from '@/lib/sound';
import { useSettings } from '@/store/settings';
import { AppEffects } from './AppEffects';
import { SoundToggle } from './SoundToggle';

vi.mock('@/lib/sound', () => ({ playSound: vi.fn(), unlockAudio: vi.fn() }));

beforeEach(() => {
  vi.mocked(playSound).mockClear();
  vi.mocked(unlockAudio).mockClear();
  useSettings.setState({ muted: true, motion: 'system' });
});

describe('AppEffects', () => {
  it('mirrors the motion setting onto <html data-motion>', () => {
    render(<AppEffects />);
    expect(document.documentElement.dataset.motion).toBeUndefined();
    act(() => useSettings.getState().setMotion('reduce'));
    expect(document.documentElement.dataset.motion).toBe('reduce');
    act(() => useSettings.getState().setMotion('full'));
    expect(document.documentElement.dataset.motion).toBe('full');
    act(() => useSettings.getState().setMotion('system'));
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it('does not touch WebAudio on the first gesture while muted', () => {
    render(<AppEffects />);
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(unlockAudio).not.toHaveBeenCalled();
  });

  it('unlocks audio once, on the first gesture after sound is on', () => {
    useSettings.setState({ muted: false });
    render(<AppEffects />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new Event('pointerdown'));
    expect(unlockAudio).toHaveBeenCalledTimes(1);
  });

  it('renders nothing', () => {
    const { container } = render(<AppEffects />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SoundToggle', () => {
  it('starts muted and toggles the settings store', async () => {
    const user = userEvent.setup();
    render(<SoundToggle />);
    const toggle = screen.getByRole('button', { name: 'Sound' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(useSettings.getState().muted).toBe(false);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // Unmuting unlocks audio inside the click and confirms with a tick.
    expect(unlockAudio).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith('click');
    await user.click(toggle);
    expect(useSettings.getState().muted).toBe(true);
    expect(playSound).toHaveBeenCalledTimes(1);
  });
});
