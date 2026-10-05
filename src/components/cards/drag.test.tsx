// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { DraggableCard, DropZone, dropTargetAt, useDragState } from './drag';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

function stubElementsFromPoint(fn: (x: number, y: number) => Element[]) {
  const original = document.elementsFromPoint;
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: fn });
  return () =>
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: original });
}

describe('dropTargetAt', () => {
  it('finds the nearest data-drop-id ancestor under the point, skipping the dragged element', () => {
    render(
      <div>
        <div data-drop-id="tableau-3">
          <span data-testid="inside">card</span>
        </div>
        <div data-testid="dragged" data-drop-id="self">
          <span data-testid="dragged-child" />
        </div>
      </div>,
    );
    const dragged = screen.getByTestId('dragged');
    const restore = stubElementsFromPoint(() => [
      screen.getByTestId('dragged-child'),
      screen.getByTestId('inside'),
      document.body,
    ]);
    try {
      expect(dropTargetAt(10, 10, dragged)).toBe('tableau-3');
      expect(dropTargetAt(10, 10)).toBe('self');
    } finally {
      restore();
    }
  });

  it('returns null when nothing droppable is under the pointer', () => {
    const restore = stubElementsFromPoint(() => [document.body]);
    try {
      expect(dropTargetAt(0, 0)).toBeNull();
    } finally {
      restore();
    }
  });
});

describe('DropZone', () => {
  it('exposes its id and highlights while a drag hovers it', () => {
    function Probe() {
      const s = useDragState();
      return <span data-testid="probe">{s.activeId ?? 'idle'}</span>;
    }
    render(
      <>
        <DropZone id="foundation-1" label="Foundation 1" data-testid="zone">
          {({ isOver }) => <span>{isOver ? 'over' : 'not over'}</span>}
        </DropZone>
        <DraggableCard code="AS" dragId="card-AS" onDrop={() => {}} />
        <Probe />
      </>,
    );
    const zone = screen.getByRole('group', { name: 'Foundation 1' });
    expect(zone).toHaveAttribute('data-drop-id', 'foundation-1');
    expect(screen.getByText('not over')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ace of Spades' })).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('idle');
  });

  it('stops accepting drops when disabled', () => {
    render(<DropZone id="z" disabled data-testid="zone" />);
    expect(screen.getByTestId('zone')).not.toHaveAttribute('data-drop-id');
  });
});

describe('useCardDrag drop flow', () => {
  it('drops on an accepting target and refuses others', async () => {
    const onDrop = vi.fn();
    const onCancel = vi.fn();
    render(
      <>
        <DropZone id="ok" data-testid="ok" />
        <DropZone id="nope" data-testid="nope" />
        <DraggableCard
          code="KH"
          dragId="kh"
          payload={{ from: 'waste' }}
          canDrop={(target) => target === 'ok'}
          onDrop={onDrop}
          onCancel={onCancel}
          wrapperClassName="drag-me"
        />
      </>,
    );
    const wrapper = document.querySelector('.drag-me') as HTMLElement;
    expect(wrapper).toHaveStyle({ touchAction: 'none' });

    // Simulate motion's drag lifecycle via pointer events on the element.
    let target = 'ok';
    const restore = stubElementsFromPoint(() => [screen.getByTestId(target)]);
    try {
      await act(async () => {
        await dragOnce(wrapper);
      });
      expect(onDrop).toHaveBeenCalledWith('ok', { from: 'waste' });
      target = 'nope';
      await act(async () => {
        await dragOnce(wrapper);
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onDrop).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });
});

describe('useCardDrag cleanup', () => {
  it('clears the global drag state when the source unmounts mid-drag', async () => {
    function Probe() {
      const s = useDragState();
      return <span data-testid="probe">{s.activeId ?? 'idle'}</span>;
    }
    function Board({ show }: { show: boolean }) {
      return (
        <>
          {show && (
            <DraggableCard code="QS" dragId="qs" onDrop={() => {}} wrapperClassName="drag-qs" />
          )}
          <Probe />
        </>
      );
    }
    const restore = stubElementsFromPoint(() => [document.body]);
    try {
      const { rerender } = render(<Board show />);
      const wrapper = document.querySelector('.drag-qs') as HTMLElement;
      await act(async () => {
        await dragStart(wrapper);
      });
      expect(screen.getByTestId('probe')).toHaveTextContent('qs');
      rerender(<Board show={false} />);
      expect(screen.getByTestId('probe')).toHaveTextContent('idle');
      // Release the pointer so motion's window listeners settle.
      await act(async () => {
        window.dispatchEvent(new PointerEvent('pointerup', pointer(80, 80, 0)));
        await frame();
      });
    } finally {
      restore();
    }
  });
});

function pointer(x: number, y: number, buttons = 1) {
  return {
    bubbles: true,
    clientX: x,
    clientY: y,
    pageX: x,
    pageY: y,
    pointerId: 1,
    button: 0,
    buttons,
    isPrimary: true,
  };
}

/** Press and move far enough for motion to start a drag, without releasing. */
async function dragStart(el: HTMLElement) {
  el.dispatchEvent(new PointerEvent('pointerdown', pointer(10, 10)));
  await frame();
  for (const x of [20, 40, 60, 80]) {
    window.dispatchEvent(new PointerEvent('pointermove', pointer(x, x)));
    await frame();
  }
}

async function dragOnce(el: HTMLElement) {
  const opts = (x: number, y: number) => ({
    bubbles: true,
    clientX: x,
    clientY: y,
    pageX: x,
    pageY: y,
    pointerId: 1,
    button: 0,
    buttons: 1,
    isPrimary: true,
  });
  el.dispatchEvent(new PointerEvent('pointerdown', opts(10, 10)));
  await frame();
  for (const x of [20, 40, 60, 80]) {
    window.dispatchEvent(new PointerEvent('pointermove', opts(x, x)));
    await frame();
  }
  window.dispatchEvent(new PointerEvent('pointerup', { ...opts(80, 80), buttons: 0 }));
  await frame();
}

function frame() {
  return new Promise<void>((r) => setTimeout(r, 20));
}
