'use client';

import React, { useRef } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableGridProps {
  /** The ids that can be dragged, in their current order. */
  ids: string[];
  onMove: (fromId: string, toId: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * A grid whose children (SortableTile) can be reordered by dragging: a mouse
 * drag of a few pixels, a press-and-hold on touch screens (so a swipe still
 * scrolls), or each tile's grip with the keyboard (Space, arrows, Space).
 */
export default function SortableGrid({ ids, onMove, disabled, children }: SortableGridProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };
  return (
    <DndContext
      sensors={disabled ? [] : sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy} disabled={disabled}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

interface SortableTileProps {
  id: string;
  /** What the grip announces, e.g. "Reorder White T-Shirt". */
  label: string;
  /** A tile that stays put (e.g. a dirty piece, always at the end). */
  fixed?: boolean;
  children: React.ReactNode;
}

/** One draggable tile in a SortableGrid. A click that ends a drag is
 * swallowed, so dropping a piece doesn't also open it. */
export function SortableTile({ id, label, fixed = false, children }: SortableTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: fixed });
  const dragged = useRef(false);
  if (isDragging) dragged.current = true;
  // Mouse and touch start a drag anywhere on the tile; the keyboard uses the grip.
  const { onKeyDown, ...pointer } = (listeners ?? {}) as Record<
    string,
    (event: React.SyntheticEvent) => void
  >;

  return (
    <li
      ref={setNodeRef}
      data-dragging={isDragging || undefined}
      className={`relative group ${isDragging ? 'z-20' : ''}`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : undefined,
      }}
      {...(fixed ? {} : pointer)}
      onClickCapture={(e) => {
        if (dragged.current) {
          e.preventDefault();
          e.stopPropagation();
          dragged.current = false;
        }
      }}
    >
      <div className={isDragging ? 'scale-[1.04] shadow-xl rounded-xl transition-transform' : ''}>
        {children}
      </div>
      {!fixed && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={onKeyDown}
          aria-label={label}
          className="absolute top-1.5 left-1.5 w-8 h-8 rounded-full bg-white/90 border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-grab"
        >
          <GripVertical size={15} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
