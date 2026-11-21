import type { Task, TaskStatus } from "@/lib/board-data";
import { Icon } from "@/components/ui/icon";
import { TaskCard } from "@/components/sprint/task-card";

export const statusDots: Record<TaskStatus, string> = { "To do": "bg-faint", "In progress": "bg-brand-500", Done: "bg-success" };

type BoardColumnProps = {
  status: TaskStatus;
  tasks: Task[];
  wide?: boolean;
  className?: string;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onCreateTask: () => void;
};

export function BoardColumn({ status, tasks, wide, className = "", onStatusChange, onEditTask, onDeleteTask, onCreateTask }: BoardColumnProps) {
  // New tasks always start in "To do", so only that column offers an inline add button.
  const canAdd = status === "To do";
  return <section aria-label={status} className={`flex min-w-0 flex-col rounded-2xl bg-sunken p-2 ${className}`}>
    <header className="flex h-9 items-center gap-2 px-2">
      <span className={`size-2 rounded-full ${statusDots[status]}`} />
      <h3 className="m-0 text-[13px] font-semibold text-ink-soft">{status}</h3>
      <span className="rounded-md bg-surface px-1.5 py-px text-xs text-muted">{tasks.length}</span>
    </header>
    <div className={`grid gap-2 ${wide ? "sm:grid-cols-2 xl:grid-cols-3" : ""}`}>
      {tasks.map((task) => <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onEdit={onEditTask} onDelete={onDeleteTask} />)}
      {tasks.length === 0 && !canAdd && <p className="px-2 py-6 text-center text-[13px] text-faint">No tasks</p>}
    </div>
    {canAdd && <button onClick={onCreateTask} className="mt-2 flex h-10 items-center gap-1.5 rounded-xl px-3 text-left text-[13px] font-medium text-muted hover:bg-surface hover:text-brand-600"><Icon name="plus" size={16} />Add task</button>}
  </section>;
}
