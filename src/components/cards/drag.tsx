'use client';
/**
 * Pointer-based card drag & drop on top of motion's `drag` (mouse, pen and
 * touch). While dragging, the element under the pointer that carries a
 * `data-drop-id` attribute is the drop target. Releasing over a target that
 * accepts the drop calls `onDrop(targetId)`; otherwise the card snaps back.
 *
 * Keyboard alternatives (select a card, then a destination) are provided by the
 * boards themselves — dragging is an extra, never the only path.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { motion } from 'motion/react';
import { create } from 'zustand';
import { useReducedMotionPref } from '@/lib/motion';
import { PlayingCard, type PlayingCardProps } from './PlayingCard';

interface DragStore {
  /** Drag source currently being dragged. */
  activeId: string | null;
  /** Drop target under the pointer. */
  overId: string | null;
  /** Whether the active source may be dropped on `overId`. */
  overValid: boolean;
}

const useDragStore = create<DragStore>(() => ({ activeId: null, overId: null, overValid: false }));

/** Current drag state (for boards that want to style things while dragging). */
export function useDragState(): DragStore {
  return useDragStore();
}

/** Whether a drag is hovering the drop target `id` (and whether it would be accepted). */
export function useDropTargetState(id: string | undefined): {
  isOver: boolean;
  isValid: boolean;
  isDragging: boolean;
} {
  const isDragging = useDragStore((s) => s.activeId !== null);
  const isOver = useDragStore((s) => id !== undefined && s.overId === id);
  const isValid = useDragStore((s) => id !== undefined && s.overId === id && s.overValid);
  return { isOver, isValid, isDragging };
}

type DragEvent = MouseEvent | TouchEvent | PointerEvent;
interface DragInfo {
  point: { x: number; y: number };
}

/** The `data-drop-id` of the drop target under a viewport point, skipping `self`. */
export function dropTargetAt(x: number, y: number, self?: Element | null): string | null {
  if (typeof document === 'undefined') return null;
  const stack: Element[] =
    typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(x, y)
      : [document.elementFromPoint(x, y)].filter((e): e is Element => e !== null);
  for (const el of stack) {
    if (self && self.contains(el)) continue;
    const zone = el.closest('[data-drop-id]');
    if (zone && !(self && self.contains(zone))) return zone.getAttribute('data-drop-id');
  }
  return null;
}

function clientPoint(info: DragInfo): { x: number; y: number } {
  // motion reports page coordinates; elementsFromPoint wants viewport ones.
  return { x: info.point.x - window.scrollX, y: info.point.y - window.scrollY };
}

export interface UseCardDragOptions<P = unknown> {
  /** Unique id of this drag source. */
  id: string;
  payload?: P;
  disabled?: boolean;
  /** Return false to refuse a target (the card then snaps back). */
  canDrop?: (targetId: string, payload: P | undefined) => boolean;
  onDrop: (targetId: string, payload: P | undefined) => void;
  onDragStart?: () => void;
  /** Released over nothing (or over a refused target). */
  onCancel?: () => void;
}

/**
 * Spread `dragProps` onto a motion element (e.g. `<motion.div {...dragProps}>`).
 * A click that ends a drag is swallowed so it does not also "tap" the card.
 */
export function useCardDrag<P = unknown>({
  id,
  payload,
  disabled = false,
  canDrop,
  onDrop,
  onDragStart,
  onCancel,
}: UseCardDragOptions<P>) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // If the source unmounts mid-drag (e.g. the board re-deals), clear the global
  // drag state so drop targets stop glowing and boards stop treating it as live.
  useEffect(
    () => () => {
      if (useDragStore.getState().activeId === id) {
        useDragStore.setState({ activeId: null, overId: null, overValid: false });
      }
    },
    [id],
  );

  const accepts = (target: string | null): target is string =>
    target !== null && target !== id && (canDrop ? canDrop(target, payload) : true);

  const dragProps = {
    ref,
    drag: !disabled,
    dragSnapToOrigin: true,
    dragMomentum: false,
    dragElastic: 1,
    dragTransition: reduced
      ? { bounceStiffness: 2000, bounceDamping: 100 }
      : { bounceStiffness: 500, bounceDamping: 32 },
    whileDrag: { scale: reduced ? 1 : 1.06, zIndex: 60 },
    onPointerDownCapture: () => {
      draggedRef.current = false;
    },
    onClickCapture: (e: ReactMouseEvent) => {
      if (draggedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        draggedRef.current = false;
      }
    },
    onDragStart: () => {
      draggedRef.current = true;
      setIsDragging(true);
      useDragStore.setState({ activeId: id, overId: null, overValid: false });
      onDragStart?.();
    },
    onDrag: (_e: DragEvent, info: DragInfo) => {
      const { x, y } = clientPoint(info);
      const over = dropTargetAt(x, y, ref.current);
      const state = useDragStore.getState();
      const valid = accepts(over);
      if (state.overId !== over || state.overValid !== valid) {
        useDragStore.setState({ overId: over, overValid: valid });
      }
    },
    onDragEnd: (_e: DragEvent, info: DragInfo) => {
      const { x, y } = clientPoint(info);
      const target = dropTargetAt(x, y, ref.current);
      setIsDragging(false);
      useDragStore.setState({ activeId: null, overId: null, overValid: false });
      if (accepts(target)) onDrop(target, payload);
      else onCancel?.();
    },
    style: { touchAction: 'none', cursor: disabled ? undefined : 'grab' } as CSSProperties,
  };

  return { dragProps, isDragging };
}

export interface DraggableCardProps<P = unknown> extends Omit<PlayingCardProps, 'ref'> {
  dragId: string;
  payload?: P;
  dragDisabled?: boolean;
  canDrop?: (targetId: string, payload: P | undefined) => boolean;
  onDrop: (targetId: string, payload: P | undefined) => void;
  onDragStart?: () => void;
  onCancel?: () => void;
  /** Class for the draggable wrapper. */
  wrapperClassName?: string;
  /** Extra content dragged along (e.g. the cards stacked on top in a run). */
  children?: ReactNode;
}

/** A PlayingCard that can be dragged onto any element with `data-drop-id`. */
export function DraggableCard<P = unknown>({
  dragId,
  payload,
  dragDisabled,
  canDrop,
  onDrop,
  onDragStart,
  onCancel,
  wrapperClassName,
  children,
  ...card
}: DraggableCardProps<P>) {
  const { dragProps, isDragging } = useCardDrag<P>({
    id: dragId,
    payload,
    disabled: dragDisabled || card.disabled,
    canDrop,
    onDrop,
    onDragStart,
    onCancel,
  });
  return (
    <motion.div
      {...dragProps}
      data-dragging={isDragging || undefined}
      className={`relative inline-block ${isDragging ? 'cursor-grabbing' : ''} ${
        wrapperClassName ?? ''
      }`}
    >
      <PlayingCard {...card} />
      {children}
    </motion.div>
  );
}

export interface DropZoneProps {
  /** Value reported to `onDrop` when a card is released here. */
  id: string;
  children?:
    ReactNode | ((state: { isOver: boolean; isValid: boolean; isDragging: boolean }) => ReactNode);
  className?: string;
  style?: CSSProperties;
  /** Accessible name; gives the zone role="group". */
  label?: string;
  /** Temporarily stop accepting drops. */
  disabled?: boolean;
  'data-testid'?: string;
}

/** A drop target. Glows gold while an acceptable drag hovers it (velvet if refused). */
export function DropZone({
  id,
  children,
  className,
  style,
  label,
  disabled = false,
  'data-testid': testId,
}: DropZoneProps) {
  const state = useDropTargetState(disabled ? undefined : id);
  return (
    <div
      data-drop-id={disabled ? undefined : id}
      data-drag-over={state.isOver || undefined}
      data-testid={testId}
      role={label ? 'group' : undefined}
      aria-label={label}
      className={`relative rounded-[10px] ${className ?? ''}`}
      style={style}
    >
      {typeof children === 'function' ? children(state) : children}
      {state.isOver && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-1 rounded-[12px] border-2 ${
            state.isValid
              ? 'border-gold-300 bg-gold-300/10 shadow-glow'
              : 'border-velvet-400 bg-velvet-500/10 border-dashed'
          }`}
        />
      )}
    </div>
  );
}
