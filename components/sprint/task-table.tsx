import Link from "next/link";
import type { Task, TaskStatus } from "@/lib/board-data";
import { statusDots } from "@/components/sprint/board-column";
import { kindStyles, priorityStyles } from "@/components/sprint/task-card";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StatusSelect } from "@/components/ui/status-select";
import { daysUntil, dueLabel, formatDate } from "@/lib/format";

type TaskTableProps = {
  status: TaskStatus;
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onCreateTask: () => void;
};

const neutralBadge = "bg-sunken text-ink-soft";
const th = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint first:pl-4 last:pr-4";
const td = "px-3 py-2.5 align-middle first:pl-4 last:pr-4";

/** One status shown as a table: used when the board is filtered to a single status. */
export function TaskTable({ status, tasks, onStatusChange, onEditTask, onDeleteTask, onCreateTask }: TaskTableProps) {
  return <section aria-label={`${status} tasks`} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
    <header className="flex h-12 items-center gap-2 border-b border-line px-4">
      <span className={`size-2 rounded-full ${statusDots[status]}`} />
      <h3 className="m-0 text-[13px] font-semibold text-ink-soft">{status}</h3>
      <span className="rounded-md bg-sunken px-1.5 py-px text-xs text-muted">{tasks.length}</span>
      {status === "To do" && <button onClick={onCreateTask} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted hover:bg-canvas hover:text-brand-600"><Icon name="plus" size={15} />Add task</button>}
    </header>

    {tasks.length === 0
      ? <p className="py-12 text-center text-sm text-faint">No tasks</p>
      : <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-sunken/60">
            <tr>
              <th scope="col" className={`${th} w-24`}>Key</th>
              <th scope="col" className={th}>Task</th>
              <th scope="col" className={`${th} w-20`}>Type</th>
              <th scope="col" className={`${th} w-24`}>Priority</th>
              <th scope="col" className={`${th} w-40`}>Assignee</th>
              <th scope="col" className={`${th} w-32`}>Due</th>
              <th scope="col" className={`${th} w-20 text-center`}>Subtasks</th>
              <th scope="col" className={`${th} w-14 text-center`}><span className="sr-only">Comments</span><Icon name="chat" size={14} className="mx-auto" /></th>
              <th scope="col" className={`${th} w-14 text-center`}><span className="sr-only">Images</span><Icon name="image" size={14} className="mx-auto" /></th>
              <th scope="col" className={`${th} w-32`}>Status</th>
              <th scope="col" className={`${th} w-20`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} onEdit={onEditTask} onDelete={onDeleteTask} />)}
          </tbody>
        </table>
      </div>}
  </section>;
}

function TaskRow({ task, onStatusChange, onEdit, onDelete }: { task: Task; onStatusChange: TaskTableProps["onStatusChange"]; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  const done = task.status === "Done";
  const days = task.deadline && !done ? daysUntil(task.deadline) : null;
  const dueTone = days === null ? "text-ink-soft" : days < 0 ? "bg-danger-soft text-danger-ink" : days <= 2 ? "bg-warning-soft text-warning-ink" : "text-ink-soft";
  const dash = <span className="text-faint">—</span>;

  return <tr className="group border-t border-line transition-colors hover:bg-canvas/60">
    <td className={`${td} whitespace-nowrap text-xs font-medium tracking-wide text-faint`}>{task.key}</td>
    <td className={`${td} max-w-0`}>
      <Link href={`/tasks/${task.id}`} className={`block truncate font-medium hover:text-brand-600 hover:underline ${done ? "text-muted line-through decoration-faint" : "text-ink"}`} title={task.title}>{task.title}</Link>
      {task.description && <p className="m-0 mt-0.5 truncate text-xs text-muted" title={task.description}>{task.description}</p>}
    </td>
    <td className={td}><span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${kindStyles[task.kind] || neutralBadge}`}>{task.kind}</span></td>
    <td className={td}><span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${priorityStyles[task.priority] || neutralBadge}`}>{task.priority}</span></td>
    <td className={td}>
      {task.assignee !== "Unassigned"
        ? <span className="flex min-w-0 items-center gap-2"><Avatar initials={task.initials} color={task.color} size="sm" /><span className="truncate text-ink-soft">{task.assignee}</span></span>
        : dash}
    </td>
    <td className={`${td} whitespace-nowrap`}>
      {task.deadline
        ? <span suppressHydrationWarning title={task.startDate ? `${formatDate(task.startDate)} – ${formatDate(task.deadline)}` : `Due ${formatDate(task.deadline)}`} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${dueTone}`}>
          <Icon name="clock" size={12} />{days !== null && days <= 2 ? dueLabel(days) : formatDate(task.deadline)}
        </span>
        : task.startDate ? <span className="text-xs text-muted">Starts {formatDate(task.startDate)}</span> : dash}
    </td>
    <td className={`${td} text-center`}>
      {task.subtaskTotal > 0
        ? <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${task.subtaskDone === task.subtaskTotal ? "bg-success-soft text-success-ink" : "text-ink-soft"}`}>{task.subtaskDone}/{task.subtaskTotal}</span>
        : dash}
    </td>
    <td className={`${td} text-center text-xs text-ink-soft`}>{task.commentCount > 0 ? task.commentCount : dash}</td>
    <td className={`${td} text-center text-xs text-ink-soft`}>{task.images.length > 0 ? task.images.length : dash}</td>
    <td className={td}><StatusSelect value={task.status} size="sm" label={`Status for ${task.title}`} onChange={(status) => onStatusChange(task.id, status)} /></td>
    <td className={td}>
      <div className="flex justify-end transition-opacity focus-within:opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100">
        <button onClick={() => onEdit(task)} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface hover:text-ink" aria-label={`Edit ${task.title}`}><Icon name="edit" size={15} /></button>
        <button onClick={() => onDelete(task)} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-danger-soft hover:text-danger-ink" aria-label={`Delete ${task.title}`}><Icon name="trash" size={15} /></button>
      </div>
    </td>
  </tr>;
}
