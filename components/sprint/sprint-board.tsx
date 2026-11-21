"use client";

import { useEffect, useRef } from "react";
import type { Sprint, Task, TaskStatus } from "@/lib/board-data";
import { BoardColumn, statusDots } from "@/components/sprint/board-column";
import { Icon } from "@/components/ui/icon";
import { daysUntil, formatDate } from "@/lib/format";

export type StatusFilter = "All" | TaskStatus;
const statuses: TaskStatus[] = ["To do", "In progress", "Done"];

type SprintBoardProps = {
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
};

export function SprintBoard(props: SprintBoardProps) {
  const { tasks, backlogCount, sprint, query, onQueryChange, filter, onFilterChange, actionError, onDismissError, onCreateTask, onCreateSprint } = props;
  const searchRef = useRef<HTMLInputElement>(null);

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
  const shownStatuses = filter === "All" ? statuses : [filter];
  const columnProps = { onStatusChange: props.onStatusChange, onEditTask: props.onEditTask, onDeleteTask: props.onDeleteTask, onCreateTask };

  return <section>
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
      : filter === "All"
        // Phones: swipeable columns. Tablet and up: three-column grid.
        ? <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:gap-5">
          {shownStatuses.map((status) => <BoardColumn key={status} status={status} tasks={matching.filter((task) => task.status === status)} className="w-[85%] shrink-0 snap-start sm:w-[60%] md:w-auto" {...columnProps} />)}
        </div>
        : <BoardColumn status={filter} tasks={matching.filter((task) => task.status === filter)} wide {...columnProps} />}

    {backlogCount > 0 && <p className="mt-5 flex items-center gap-2 text-sm text-muted"><Icon name="folder" size={16} /><strong className="font-semibold text-ink-soft">{backlogCount}</strong> unscheduled {backlogCount === 1 ? "task" : "tasks"} in backlog</p>}

    {/* Mobile floating "new task" button */}
    <button onClick={onCreateTask} className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 grid size-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/40 active:scale-95 sm:hidden" aria-label="New task"><Icon name="plus" size={24} /></button>
  </section>;
}

function SprintHeader({ tasks, sprint, sprints, onSelectSprint, onEditSprint, onCreateSprint }: SprintBoardProps) {
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
          {sprints.length > 1
            ? <div className="relative min-w-0 max-w-full"><select value={sprint.id} onChange={(event) => onSelectSprint(event.target.value)} aria-label="Select sprint" className="max-w-full appearance-none truncate rounded-lg bg-transparent py-0.5 pr-7 text-lg font-bold outline-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-100">{sprints.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status.toLowerCase() === "active" ? " (active)" : ""}</option>)}</select><Icon name="down" size={16} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" /></div>
            : <h2 className="m-0 truncate text-lg font-bold">{sprint.name}</h2>}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${active ? "bg-success-soft text-success-ink" : "bg-sunken text-muted"}`}><i className={`size-1.5 rounded-full ${active ? "bg-success" : "bg-faint"}`} />{sprint.status}</span>
        </div>
        {(dateRange || remaining !== null) && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {dateRange && <span className="flex items-center gap-1.5"><Icon name="calendar" size={14} />{dateRange}</span>}
          {remaining !== null && active && <span suppressHydrationWarning className={`flex items-center gap-1.5 ${remaining < 0 ? "font-medium text-danger-ink" : remaining <= 2 ? "font-medium text-warning-ink" : ""}`}><Icon name="clock" size={14} />{remaining < 0 ? `Ended ${-remaining}d ago` : remaining === 0 ? "Ends today" : `${remaining} ${remaining === 1 ? "day" : "days"} left`}</span>}
        </div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={() => onEditSprint(sprint)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label="Edit sprint" title="Edit sprint"><Icon name="edit" size={17} /></button>
        <button onClick={onCreateSprint} className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-2.5 text-sm font-medium text-ink-soft hover:bg-canvas" aria-label="New sprint"><Icon name="plus" size={16} /><span className="hidden sm:inline">New sprint</span></button>
      </div>
    </div>
    {sprint.description && <p className="mb-0 mt-3 text-sm leading-relaxed text-ink-soft">{sprint.description}</p>}
    <div className="mt-4 flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Sprint progress"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-[#9d84f5] transition-all duration-500" style={{ width: `${percent}%` }} /></div>
      <span className="shrink-0 text-[13px] text-muted"><strong className="font-semibold text-ink">{done}</strong>/{tasks.length} done · {percent}%</span>
    </div>
  </div>;
}
