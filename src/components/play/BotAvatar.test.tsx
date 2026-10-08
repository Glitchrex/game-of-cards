// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { type BotPersona } from '@/games/core/module';
import { useSettings } from '@/store/settings';
import { AVATAR_ACCESSORIES, BotAvatar, shade } from './BotAvatar';
import { personaForSeat, seatPersonas, stripTipPrefix, YOU_PERSONA } from './personas';
import { Seat, TurnIndicator } from './Seat';
import { ThinkingDots } from './ThinkingDots';

const persona = (accessory: BotPersona['avatar']['accessory'], name = 'Mona'): BotPersona => ({
  name,
  tagline: 'Never blinks first.',
  avatar: { bg: '#13593d', skin: '#e0ac69', accessory, accent: '#c22f47' },
});

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  useSettings.setState({ motion: 'full' });
});

describe('BotAvatar', () => {
  it.each(AVATAR_ACCESSORIES)('renders the %s accessory as a named image', (accessory) => {
    const { container } = render(<BotAvatar persona={persona(accessory, `Bot ${accessory}`)} />);
    const img = screen.getByRole('img', { name: `Bot ${accessory}` });
    expect(img.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByTestId('bot-avatar')).toHaveAttribute('data-accessory', accessory);
    const part = container.querySelector(`[data-part="${accessory}"]`);
    if (accessory === 'none') expect(container.querySelector('[data-part]')).toBeNull();
    else expect(part).not.toBeNull();
  });

  it('covers every accessory the persona contract allows', () => {
    expect([...AVATAR_ACCESSORIES].sort()).toEqual([
      'beret',
      'bow',
      'cap',
      'crown',
      'flower',
      'headphones',
      'monocle',
      'none',
      'shades',
      'turban',
    ]);
  });

  it('draws accessories in the accent colour', () => {
    const { container } = render(<BotAvatar persona={persona('crown')} />);
    expect(container.querySelector('[data-part="crown"] path')).toHaveAttribute('fill', '#c22f47');
  });

  it('shows thinking dots and says so in its name while thinking', () => {
    render(<BotAvatar persona={persona('cap')} thinking />);
    expect(screen.getByRole('img', { name: 'Mona (thinking)' })).toBeInTheDocument();
    expect(screen.getByTestId('thinking-dots')).toHaveAttribute('aria-hidden', 'true');
  });

  it('can be decorative', () => {
    render(<BotAvatar persona={persona('cap')} decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps ids unique per instance', () => {
    const { container } = render(
      <>
        <BotAvatar persona={persona('bow', 'A')} />
        <BotAvatar persona={persona('bow', 'B')} />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('shade', () => {
  it('darkens and lightens hex colours', () => {
    expect(shade('#808080', -0.5)).toBe('#404040');
    expect(shade('#000000', 1)).toBe('#ffffff');
    expect(shade('#fff', -1)).toBe('#000000');
    expect(shade('not-a-colour', 0.2)).toBe('not-a-colour');
  });
});

describe('ThinkingDots', () => {
  it('bounces three dots, or shows a static ellipsis under reduced motion', () => {
    const { rerender } = render(<ThinkingDots />);
    expect(screen.getByTestId('thinking-dots').children).toHaveLength(3);
    useSettings.setState({ motion: 'reduce' });
    rerender(<ThinkingDots />);
    expect(screen.getByTestId('thinking-dots')).toHaveTextContent('…');
    expect(screen.getByTestId('thinking-dots')).toHaveAttribute('data-static');
  });
});

describe('Seat & TurnIndicator', () => {
  it('labels the seat and shows turn / thinking state', () => {
    const { rerender } = render(
      <Seat persona={persona('beret')} active={false} thinking={false} score={12}>
        <span>cards here</span>
      </Seat>,
    );
    const seat = screen.getByRole('group', { name: 'Mona' });
    expect(within(seat).getByText('Never blinks first.')).toBeInTheDocument();
    expect(within(seat).getByText('12')).toBeInTheDocument();
    expect(within(seat).getByText('cards here')).toBeInTheDocument();
    expect(seat).not.toHaveAttribute('data-active');

    rerender(<Seat persona={persona('beret')} active thinking />);
    expect(screen.getByRole('group', { name: 'Mona' })).toHaveAttribute('data-active');
    expect(screen.getByText('Thinking')).toBeInTheDocument();

    rerender(<Seat label="Dealer" persona={persona('beret')} active thinking={false} />);
    expect(screen.getByRole('group', { name: 'Dealer' })).toHaveTextContent('Their turn');

    rerender(<Seat active thinking={false} />);
    expect(screen.getByRole('group', { name: 'You' })).toHaveTextContent('Your turn');
  });

  it('says whose turn it is', () => {
    const { rerender } = render(<TurnIndicator yourTurn thinkingName={null} />);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
    rerender(<TurnIndicator yourTurn={false} thinkingName="Raju" />);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Raju is thinking…');
    rerender(<TurnIndicator yourTurn={false} over />);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Hand over');
    rerender(<TurnIndicator yourTurn={false} />);
    expect(screen.queryByTestId('turn-indicator')).not.toBeInTheDocument();
  });
});

describe('persona helpers', () => {
  it('index BoardProps.personas by seat', () => {
    const bots = [persona('cap', 'One'), persona('bow', 'Two')];
    const seats = seatPersonas(bots);
    expect(seats[0]).toBe(YOU_PERSONA);
    expect(seats[1]?.name).toBe('One');
    expect(seats[2]?.name).toBe('Two');
    expect(personaForSeat(bots, 0)).toBe(YOU_PERSONA);
    expect(personaForSeat(bots, 2)?.name).toBe('Two');
    expect(personaForSeat(bots, 3)).toBeNull();
  });

  it('strips the "Tip:" prefix from content tips', () => {
    expect(stripTipPrefix('Tip: split Aces.')).toBe('Split Aces.');
    expect(stripTipPrefix('Always split Aces.')).toBe('Always split Aces.');
  });
});
