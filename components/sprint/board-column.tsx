"use client";

import type { CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task, TaskStatus } from "@/lib/board-data";
import { Icon } from "@/components/ui/icon";
import { GripHandle, sortableStyle } from "@/components/ui/sortable";
import { TaskCard } from "@/components/sprint/task-card";

export const statusDots: Record<TaskStatus, string> = { "To do": "bg-faint", "In progress": "bg-brand-500", Done: "bg-success" };

/** Drop-target id for a column (used when a column is empty or a card is dropped below the last one). */
export const columnDropId = (status: TaskStatus) => `column:${status}`;

type CardActions = {
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
};

type BoardColumnProps = CardActions & {
  status: TaskStatus;
  tasks: Task[];
  wide?: boolean;
  /** When true, cards can be dragged within and between columns. */
  sortable?: boolean;
  className?: string;
  style?: CSSProperties;
  onCreateTask: () => void;
};

export function BoardColumn({ status, tasks, wide, sortable = false, className = "", style, onStatusChange, onEditTask, onDeleteTask, onCreateTask }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(status), disabled: !sortable });
  // New tasks always start in "To do", so only that column offers an inline add button.
  const canAdd = status === "To do";
  const actions = { onStatusChange, onEditTask, onDeleteTask };

  return <section aria-label={status} style={style} className={`flex min-w-0 flex-col rounded-2xl bg-sunken p-2 transition-colors ${isOver ? "ring-2 ring-brand-200" : ""} ${className}`}>
    <header className="flex h-9 items-center gap-2 px-2">
      <span className={`size-2 rounded-full ${statusDots[status]}`} />
      <h3 className="m-0 text-[13px] font-semibold text-ink-soft">{status}</h3>
      <span className="rounded-md bg-surface px-1.5 py-px text-xs text-muted">{tasks.length}</span>
    </header>
    <SortableContext id={status} items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy} disabled={!sortable}>
      <div ref={setNodeRef} className={`grid content-start gap-2 ${wide ? "sm:grid-cols-2 xl:grid-cols-3" : ""} ${sortable ? "min-h-16" : ""}`}>
        {tasks.map((task) => sortable
          ? <SortableTaskCard key={task.id} task={task} {...actions} />
          : <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onEdit={onEditTask} onDelete={onDeleteTask} />)}
        {tasks.length === 0 && !canAdd && <p className="px-2 py-6 text-center text-[13px] text-faint">{sortable ? "Drop tasks here" : "No tasks"}</p>}
      </div>
    </SortableContext>
    {canAdd && <button onClick={onCreateTask} className="mt-2 flex h-10 items-center gap-1.5 rounded-xl px-3 text-left text-[13px] font-medium text-muted hover:bg-surface hover:text-brand-600"><Icon name="plus" size={16} />Add task</button>}
  </section>;
}

function SortableTaskCard({ task, onStatusChange, onEditTask, onDeleteTask }: CardActions & { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return <div ref={setNodeRef} style={sortableStyle(transform, transition)}>
    <TaskCard task={task} onStatusChange={onStatusChange} onEdit={onEditTask} onDelete={onDeleteTask}
      dragState={isDragging ? "placeholder" : undefined}
      handle={<GripHandle label={`Move ${task.title}`} attributes={attributes} listeners={listeners} className="size-7" />} />
  </div>;
}
