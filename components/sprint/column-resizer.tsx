"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

type ColumnResizerProps = {
  label: string;
  /** Width of the column before the handle, as a percentage of the board (for screen readers). */
  value: number;
  onStart: () => void;
  /** Pointer travel since the drag began, as a percentage of the columns' combined width. */
  onMove: (deltaPercent: number) => void;
  onEnd: () => void;
  /** Keyboard nudge, in percent. */
  onStep: (deltaPercent: number) => void;
  onReset: () => void;
};

/**
 * The draggable border between two board columns (tablet and up). It also serves as the gap
 * between them. Drag to resize, double-click to reset, or focus it and use the arrow keys.
 */
export function ColumnResizer({ label, value, onStart, onMove, onEnd, onStep, onReset }: ColumnResizerProps) {
  const drag = useRef<{ x: number; width: number } | null>(null);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const board = handle.parentElement;
    if (!board) return;
    const handles = Array.from(board.querySelectorAll<HTMLElement>("[data-column-resizer]"));
    const width = board.clientWidth - handles.reduce((sum, item) => sum + item.offsetWidth, 0);
    if (width <= 0) return;
    handle.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    onStart();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    onMove(((event.clientX - drag.current.x) / drag.current.width) * 100);
  }

  function finish() {
    if (!drag.current) return;
    drag.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onEnd();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") onStep(-step);
    else if (event.key === "ArrowRight") onStep(step);
    else if (event.key === "Home" || event.key === "Enter") onReset();
    else return;
    event.preventDefault();
  }

  return <div
    data-column-resizer
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    aria-valuenow={Math.round(value)}
    aria-valuemin={0}
    aria-valuemax={100}
    tabIndex={0}
    title="Drag to resize · double-click to reset"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={finish}
    onPointerCancel={finish}
    onLostPointerCapture={finish}
    onDoubleClick={onReset}
    onKeyDown={onKeyDown}
    className="group/resizer relative hidden w-3 shrink-0 cursor-col-resize touch-none justify-center outline-none md:flex lg:w-5"
  >
    <span className="my-3 w-0.5 rounded-full bg-transparent transition-colors group-hover/resizer:bg-brand-200 group-focus-visible/resizer:bg-brand-500 group-active/resizer:bg-brand-500" />
  </div>;
}
