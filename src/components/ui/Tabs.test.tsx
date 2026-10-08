// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { Tabs } from './Tabs';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const items = [
  { id: 'posts', label: 'Posts', content: <p>All posts</p> },
  { id: 'comments', label: 'Comments', content: <p>All comments</p> },
  { id: 'messages', label: 'Messages', content: <p>All messages</p> },
];

describe('Tabs', () => {
  it('links tabs and panels and moves selection with arrow keys', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Tabs label="Moderation" items={items} onValueChange={onValueChange} />);
    expect(screen.getByRole('tablist', { name: 'Moderation' })).toBeInTheDocument();
    const posts = screen.getByRole('tab', { name: 'Posts' });
    expect(posts).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Posts' })).toHaveTextContent('All posts');

    await user.click(posts);
    await user.keyboard('{ArrowRight}');
    const comments = screen.getByRole('tab', { name: 'Comments' });
    expect(comments).toHaveFocus();
    expect(comments).toHaveAttribute('aria-selected', 'true');
    expect(onValueChange).toHaveBeenLastCalledWith('comments');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('All comments');

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Messages' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(posts).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Messages' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab').filter((t) => t.tabIndex === 0)).toHaveLength(1);
  });

  it('manual activation only selects on Enter/Space', async () => {
    const user = userEvent.setup();
    render(<Tabs label="Moderation" items={items} activation="manual" />);
    await user.click(screen.getByRole('tab', { name: 'Posts' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Comments' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Posts' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Comments' })).toHaveAttribute('aria-selected', 'true');
  });
});
