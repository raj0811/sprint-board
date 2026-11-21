"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DraggableAttributes } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS, type Transform } from "@dnd-kit/utilities";
import { Icon } from "@/components/ui/icon";

/**
 * Mouse drags start after a few pixels of movement (so clicks still work);
 * touch drags start after a short press (so the page can still scroll); keyboard uses Space + arrows.
 */
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function sortableStyle(transform: Transform | null, transition: string | undefined): CSSProperties {
  return { transform: CSS.Translate.toString(transform), transition };
}

type GripHandleProps = {
  label: string;
  attributes: DraggableAttributes;
  listeners: HTMLAttributes<HTMLElement> | undefined;
  className?: string;
};

/** The six-dot handle used to drag tasks and features. */
export function GripHandle({ label, attributes, listeners, className = "" }: GripHandleProps) {
  return <button type="button" {...attributes} {...listeners} aria-label={label} title="Drag to reorder" className={`grid shrink-0 cursor-grab touch-none place-items-center rounded-md text-faint hover:bg-canvas hover:text-ink-soft active:cursor-grabbing ${className}`}>
    <Icon name="grip" size={16} strokeWidth={3} />
  </button>;
}
