import Link from "next/link";
import type { Task, TaskStatus } from "@/lib/board-data";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StatusSelect } from "@/components/ui/status-select";
import { daysUntil, dueLabel, formatDate } from "@/lib/format";

const priorityStyles = { High: "bg-danger-soft text-danger-ink", Medium: "", Low: "bg-success-soft text-success-ink" };
const kindStyles = { Bug: "bg-warning-soft text-warning-ink", Story: "bg-brand-50 text-brand-700", Task: "" };

type TaskCardProps = { task: Task; onStatusChange: (id: string, status: TaskStatus) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void };

export function TaskCard({ task, onStatusChange, onEdit, onDelete }: TaskCardProps) {
  const done = task.status === "Done";
  const days = task.deadline && !done ? daysUntil(task.deadline) : null;
  const dueTone = days === null ? "text-muted" : days < 0 ? "bg-danger-soft text-danger-ink" : days <= 2 ? "bg-warning-soft text-warning-ink" : "text-muted";

  return <article className="group relative rounded-xl border border-line bg-surface p-3 shadow-[0_1px_2px_#1d1b290a] transition hover:border-line-strong hover:shadow-[0_4px_14px_#1d1b2912]">
    <div className="flex items-start gap-1">
      <Link href={`/tasks/${task.id}`} className={`min-w-0 flex-1 rounded text-sm font-medium leading-snug outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:ring-2 focus-visible:ring-brand-100 ${done ? "text-muted line-through decoration-faint" : "text-ink"}`}>{task.title}</Link>
      <div className="relative z-10 -mr-1 -mt-1 flex shrink-0 transition-opacity focus-within:opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100">
        <button onClick={() => onEdit(task)} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-canvas hover:text-ink" aria-label={`Edit ${task.title}`}><Icon name="edit" size={15} /></button>
        <button onClick={() => onDelete(task)} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-danger-soft hover:text-danger-ink" aria-label={`Delete ${task.title}`}><Icon name="trash" size={15} /></button>
      </div>
    </div>
    {task.description && <p className="mb-0 mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{task.description}</p>}

    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11px] font-medium tracking-wide text-faint">{task.key}</span>
      {kindStyles[task.kind] && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${kindStyles[task.kind]}`}>{task.kind}</span>}
      {priorityStyles[task.priority] && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>{task.priority}</span>}
      {task.deadline && <span suppressHydrationWarning title={task.startDate ? `${formatDate(task.startDate)} – ${formatDate(task.deadline)}` : `Due ${formatDate(task.deadline)}`} className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${dueTone}`}>
        <Icon name="clock" size={12} />{days !== null && days <= 2 ? dueLabel(days) : formatDate(task.deadline)}
      </span>}
      {!task.deadline && task.startDate && <span className="flex items-center gap-1 text-[11px] text-muted"><Icon name="calendar" size={12} />Starts {formatDate(task.startDate)}</span>}
      {task.subtaskTotal > 0 && <span title="Subtasks done" className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${task.subtaskDone === task.subtaskTotal ? "bg-success-soft text-success-ink" : "text-muted"}`}><Icon name="subtask" size={12} />{task.subtaskDone}/{task.subtaskTotal}</span>}
      {task.commentCount > 0 && <span title="Comments" className="flex items-center gap-1 text-[11px] font-medium text-muted"><Icon name="chat" size={12} />{task.commentCount}</span>}
      <span className="relative z-10 ml-auto flex items-center gap-1.5">
        {task.assignee !== "Unassigned" && <span title={task.assignee}><Avatar initials={task.initials} color={task.color} size="sm" /></span>}
        <StatusSelect value={task.status} label={`Status for ${task.title}`} onChange={(status) => onStatusChange(task.id, status)} />
      </span>
    </div>
  </article>;
}
