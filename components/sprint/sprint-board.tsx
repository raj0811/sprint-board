"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { closestCorners, DndContext, DragOverlay, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Sprint, Task, TaskStatus } from "@/lib/board-data";
import { BoardColumn, statusDots } from "@/components/sprint/board-column";
import { SprintTabs } from "@/components/sprint/sprint-tabs";
import { TaskCard } from "@/components/sprint/task-card";
import { ColumnResizer } from "@/components/sprint/column-resizer";
import { TaskTable } from "@/components/sprint/task-table";
import { ImageGallery } from "@/components/ui/image-gallery";
import { useStoredString } from "@/lib/use-stored-value";
import { Icon } from "@/components/ui/icon";
import { useDragSensors } from "@/components/ui/sortable";
import { daysUntil, formatDate } from "@/lib/format";

export type StatusFilter = "All" | TaskStatus;
export type BoardColumns = Record<TaskStatus, string[]>;
const statuses: TaskStatus[] = ["To do", "In progress", "Done"];

type SprintBoardProps = {
  projectId: string;
  tasks: Task[];
  backlogCount: number;
  sprint: Sprint | null;
  sprints: Sprint[];
  query: string;
  onQueryChange: (query: string) => void;
  filter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  actionError: string;
  onDismissError: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onCreateTask: () => void;
  onCreateSprint: () => void;
  onEditSprint: (sprint: Sprint) => void;
  onSelectSprint: (sprintId: string) => void;
  /** Persist a new card layout after a drag (status per column + order within it). */
  onReorderTasks: (columns: BoardColumns) => void;
  onError: (message: string) => void;
};

const EQUAL_WIDTHS = [100 / 3, 100 / 3, 100 / 3];
const MIN_COLUMN_WIDTH = 15;

/** Saved widths, or equal thirds when nothing (or something invalid) is stored. */
function parseWidths(raw: string | null): number[] {
  if (!raw) return EQUAL_WIDTHS;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value) && value.length === statuses.length && value.every((width) => typeof width === "number" && width >= MIN_COLUMN_WIDTH)) return value;
  } catch { /* fall through */ }
  return EQUAL_WIDTHS;
}

/** Moves the border before column `index` by `delta` percent; only its two neighbours change size. */
function resizeColumns(base: number[], index: number, delta: number): number[] {
  const pair = base[index - 1] + base[index];
  const left = Math.min(Math.max(base[index - 1] + delta, MIN_COLUMN_WIDTH), pair - MIN_COLUMN_WIDTH);
  const next = [...base];
  next[index - 1] = left;
  next[index] = pair - left;
  return next;
}

function columnsFrom(tasks: Task[]): BoardColumns {
  return { "To do": tasks.filter((task) => task.status === "To do").map((task) => task.id), "In progress": tasks.filter((task) => task.status === "In progress").map((task) => task.id), Done: tasks.filter((task) => task.status === "Done").map((task) => task.id) };
}

export function SprintBoard(props: SprintBoardProps) {
  const { tasks, backlogCount, sprint, query, onQueryChange, filter, onFilterChange, actionError, onDismissError, onCreateTask, onCreateSprint } = props;
  const searchRef = useRef<HTMLInputElement>(null);
  const sensors = useDragSensors();

  // Local card layout while dragging; reset whenever fresh tasks arrive from the server.
  const [columns, setColumns] = useState<BoardColumns>(() => columnsFrom(tasks));
  const [seenTasks, setSeenTasks] = useState(tasks);
  if (seenTasks !== tasks) {
    setSeenTasks(tasks);
    setColumns(columnsFrom(tasks));
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragStart = useRef<BoardColumns | null>(null);

  // Column widths (percentages) are saved per browser; while a border is being dragged the live widths win.
  const [storedWidths, setStoredWidths] = useStoredString("board-column-widths");
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null);
  const resizeStart = useRef<number[] | null>(null);
  const widths = liveWidths ?? parseWidths(storedWidths);
  const saveWidths = (next: number[]) => setStoredWidths(JSON.stringify(next.map((width) => Math.round(width * 10) / 10)));

  // Ctrl/⌘+K focuses search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabs = <SprintTabs projectId={props.projectId} sprints={props.sprints} selectedId={sprint?.id} onSelect={props.onSelectSprint} onCreate={onCreateSprint} onError={props.onError} />;

  if (!sprint) {
    return <section className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500"><Icon name="sprint" size={22} /></span>
      <h2 className="mt-4 text-base font-semibold">No sprints yet</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">Create a sprint to start adding tasks to this project.</p>
      <button onClick={onCreateSprint} className="mx-auto mt-5 flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 hover:bg-brand-600"><Icon name="plus" size={18} />Create sprint</button>
    </section>;
  }

  const needle = query.trim().toLowerCase();
  const matching = needle ? tasks.filter((task) => `${task.title} ${task.description} ${task.key} ${task.assignee}`.toLowerCase().includes(needle)) : tasks;
  const counts = Object.fromEntries(statuses.map((status) => [status, matching.filter((task) => task.status === status).length])) as Record<TaskStatus, number>;
  const columnProps = { onStatusChange: props.onStatusChange, onEditTask: props.onEditTask, onDeleteTask: props.onDeleteTask, onCreateTask };
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  // Dragging only makes sense with the full board visible.
  const canDrag = !needle && filter === "All";
  const columnTasks = (status: TaskStatus) => columns[status].flatMap((id) => {
    const task = taskById.get(id);
    return task ? [{ ...task, status }] : [];
  });

  const containerOf = (id: string): TaskStatus | undefined =>
    id.startsWith("column:") ? id.slice("column:".length) as TaskStatus : statuses.find((status) => columns[status].includes(id));

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    dragStart.current = columns;
  }

  // Moving over another column: move the card there so the gap opens where it will land.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((current) => {
      const target = current[to];
      const overIndex = target.indexOf(String(over.id));
      const index = overIndex === -1 ? target.length : overIndex;
      return { ...current, [from]: current[from].filter((id) => id !== active.id), [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)] };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const start = dragStart.current;
    dragStart.current = null;
    let next = columns;
    const column = over ? containerOf(String(over.id)) : undefined;
    if (column && containerOf(String(active.id)) === column) {
      const ids = columns[column];
      const from = ids.indexOf(String(active.id));
      const to = over && !String(over.id).startsWith("column:") ? ids.indexOf(String(over.id)) : ids.length - 1;
      if (from !== to && from !== -1 && to !== -1) next = { ...columns, [column]: arrayMove(ids, from, to) };
    }
    setColumns(next);
    if (start && statuses.some((status) => start[status].join() !== next[status].join())) props.onReorderTasks(next);
  }

  function onDragCancel() {
    setActiveId(null);
    if (dragStart.current) setColumns(dragStart.current);
    dragStart.current = null;
  }

  const activeTask = activeId ? taskById.get(activeId) : undefined;

  return <section>
    {tabs}
    <SprintHeader {...props} />

    {/* Toolbar */}
    <div className="mb-4 mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-faint focus-within:border-brand-200 focus-within:ring-2 focus-within:ring-brand-100 sm:h-10 sm:w-72">
        <Icon name="search" size={17} />
        <input ref={searchRef} type="search" aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(event) => onQueryChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint sm:text-sm" />
        {query ? <button onClick={() => onQueryChange("")} className="grid size-6 place-items-center rounded-md hover:bg-canvas" aria-label="Clear search"><Icon name="close" size={14} /></button> : <kbd className="hidden rounded border border-line bg-canvas px-1.5 py-0.5 font-sans text-[10px] lg:block">Ctrl K</kbd>}
      </label>
      <div role="tablist" aria-label="Filter by status" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {(["All", ...statuses] as StatusFilter[]).map((option) => {
          const active = filter === option;
          const count = option === "All" ? matching.length : counts[option];
          return <button key={option} role="tab" aria-selected={active} onClick={() => onFilterChange(option)} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${active ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink-soft hover:border-line-strong"}`}>
            {option !== "All" && <span className={`size-2 rounded-full ${statusDots[option]}`} />}{option}<span className={`text-xs ${active ? "text-surface/70" : "text-faint"}`}>{count}</span>
          </button>;
        })}
      </div>
      <button onClick={onCreateTask} className="hidden h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 hover:bg-brand-600 sm:ml-auto sm:flex"><Icon name="plus" size={17} />New task</button>
    </div>

    {actionError && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink"><span className="flex-1">{actionError}</span><button onClick={onDismissError} className="grid size-7 place-items-center rounded-md hover:bg-danger-soft-hover" aria-label="Dismiss"><Icon name="close" size={14} /></button></div>}

    {needle && matching.length === 0 ? <p className="rounded-2xl border border-dashed border-line bg-surface py-12 text-center text-sm text-muted">No tasks match “{query.trim()}”.</p>
      : <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        {filter === "All"
          // Phones: swipeable columns (snap is off while dragging so the board can auto-scroll).
          // Tablet and up: three columns whose widths are set by dragging the borders between them.
          ? <div className={`no-scrollbar -mx-4 flex scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:gap-0 md:overflow-visible md:px-0 ${activeId ? "" : "snap-x snap-mandatory"}`}>
            {statuses.map((status, index) => <Fragment key={status}>
              {index > 0 && <ColumnResizer
                label={`Resize ${statuses[index - 1]} and ${status} columns`}
                value={widths[index - 1]}
                onStart={() => { resizeStart.current = widths; }}
                onMove={(delta) => { if (resizeStart.current) setLiveWidths(resizeColumns(resizeStart.current, index, delta)); }}
                onEnd={() => { if (liveWidths) saveWidths(liveWidths); resizeStart.current = null; setLiveWidths(null); }}
                onStep={(delta) => saveWidths(resizeColumns(widths, index, delta))}
                onReset={() => setStoredWidths(null)}
              />}
              <BoardColumn status={status} sortable={canDrag} tasks={canDrag ? columnTasks(status) : matching.filter((task) => task.status === status)}
                style={{ "--col-grow": widths[index] } as CSSProperties}
                className="w-[85%] shrink-0 snap-start sm:w-[60%] md:w-auto md:shrink md:[flex:var(--col-grow)_1_0%]" {...columnProps} />
            </Fragment>)}
          </div>
          : <TaskTable status={filter} tasks={matching.filter((task) => task.status === filter)} {...columnProps} />}
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeTask && <TaskCard task={activeTask} onStatusChange={() => {}} onEdit={() => {}} onDelete={() => {}} dragState="overlay" />}
        </DragOverlay>
      </DndContext>}
    {!canDrag && tasks.length > 1 && <p className="mt-2 text-center text-xs text-faint">Clear the search and show all statuses to drag tasks into a new order.</p>}

    {backlogCount > 0 && <p className="mt-5 flex items-center gap-2 text-sm text-muted"><Icon name="folder" size={16} /><strong className="font-semibold text-ink-soft">{backlogCount}</strong> unscheduled {backlogCount === 1 ? "task" : "tasks"} in backlog</p>}

    {/* Mobile floating "new task" button */}
    <button onClick={onCreateTask} className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 grid size-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/40 active:scale-95 sm:hidden" aria-label="New task"><Icon name="plus" size={24} /></button>
  </section>;
}

function SprintHeader({ projectId, tasks, sprint, onEditSprint, onError }: SprintBoardProps) {
  if (!sprint) return null;
  const active = sprint.status.toLowerCase() === "active";
  const done = tasks.filter((task) => task.status === "Done").length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const dateRange = [sprint.startDate, sprint.deadline].filter(Boolean).map(formatDate).join(" – ");
  const remaining = sprint.deadline ? daysUntil(sprint.deadline) : null;

  return <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 hidden size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 sm:grid"><Icon name="sprint" size={20} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 truncate text-lg font-bold">{sprint.name}</h2>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${active ? "bg-success-soft text-success-ink" : "bg-sunken text-muted"}`}><i className={`size-1.5 rounded-full ${active ? "bg-success" : "bg-faint"}`} />{sprint.status}</span>
        </div>
        {(dateRange || remaining !== null) && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {dateRange && <span className="flex items-center gap-1.5"><Icon name="calendar" size={14} />{dateRange}</span>}
          {remaining !== null && active && <span suppressHydrationWarning className={`flex items-center gap-1.5 ${remaining < 0 ? "font-medium text-danger-ink" : remaining <= 2 ? "font-medium text-warning-ink" : ""}`}><Icon name="clock" size={14} />{remaining < 0 ? `Ended ${-remaining}d ago` : remaining === 0 ? "Ends today" : `${remaining} ${remaining === 1 ? "day" : "days"} left`}</span>}
        </div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={() => onEditSprint(sprint)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label="Edit sprint" title="Edit sprint"><Icon name="edit" size={17} /></button>
      </div>
    </div>
    {sprint.description && <p className="mb-0 mt-3 text-sm leading-relaxed text-ink-soft">{sprint.description}</p>}
    <ImageGallery key={sprint.id} variant="strip" images={sprint.images} apiBase={`/api/projects/${projectId}/sprints/${sprint.id}/images`} onError={onError} />
    <div className="mt-4 flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Sprint progress"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-[#9d84f5] transition-all duration-500" style={{ width: `${percent}%` }} /></div>
      <span className="shrink-0 text-[13px] text-muted"><strong className="font-semibold text-ink">{done}</strong>/{tasks.length} done · {percent}%</span>
    </div>
  </div>;
}
