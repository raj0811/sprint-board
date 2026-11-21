"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateDialog } from "@/components/dialogs/create-dialog";
import { CanvasList } from "@/components/task/canvas-list";
import { CommentThread } from "@/components/task/comment-thread";
import { Icon } from "@/components/ui/icon";
import { StatusSelect } from "@/components/ui/status-select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { send } from "@/lib/api-client";
import { daysUntil, dueLabel, formatDate, timeAgo } from "@/lib/format";
import type { TaskStatus } from "@/lib/board-data";
import type { Comment, Subtask, TaskDetail } from "@/lib/task-detail";

type Props = { detail: TaskDetail; user: { id: string; name: string; email: string } };

export function TaskDetailView({ detail, user }: Props) {
  const router = useRouter();
  const { project, sprint, task } = detail;
  const base = `/api/projects/${project.id}/tasks/${task.id}`;
  const boardHref = `/?project=${project.id}${sprint ? `&sprint=${sprint.id}` : ""}`;
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");

  // Optimistic status changes for the task ("task") and its subtasks (by id); cleared when fresh data arrives.
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});
  const [seen, setSeen] = useState(detail);
  if (seen !== detail) {
    setSeen(detail);
    setOverrides({});
  }
  const taskStatus = overrides.task ?? task.status;
  const subtasks = detail.subtasks.map((subtask) => overrides[subtask.id] ? { ...subtask, status: overrides[subtask.id] } : subtask);
  const taskComments = detail.comments.filter((comment) => !comment.subtaskId);
  const doneCount = subtasks.filter((subtask) => subtask.status === "Done").length;

  async function run(url: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, string>) {
    const result = await send(url, method, body);
    if (result.error) {
      setError(result.error);
      return result.error;
    }
    setError("");
    router.refresh();
    return null;
  }

  async function setStatus(key: string, url: string, status: TaskStatus) {
    setOverrides((current) => ({ ...current, [key]: status }));
    if (await run(url, "PATCH", { status })) {
      setOverrides((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  async function moveToSprint(sprintId: string) {
    if (!sprintId || sprintId === sprint?.id) return;
    setMoving(true);
    await run(base, "PATCH", { sprintId });
    setMoving(false);
  }

  async function deleteTask() {
    if (!window.confirm(`Delete “${task.title}” with its subtasks and comments? This cannot be undone.`)) return;
    const result = await send(base, "DELETE");
    if (result.error) setError(result.error);
    else router.replace(boardHref);
  }

  function deleteComment(comment: Comment) {
    if (window.confirm("Delete this comment?")) void run(`${base}/comments/${comment.id}`, "DELETE");
  }

  const days = task.deadline && taskStatus !== "Done" ? daysUntil(task.deadline) : null;

  return <div className="min-h-screen bg-canvas text-ink">
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6 lg:h-16">
        <Link href={boardHref} className="flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-soft hover:bg-canvas"><Icon name="back" size={18} /><span className="hidden sm:inline">Board</span></Link>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
          <span className="hidden truncate sm:inline">{project.name}</span>
          {sprint && <><Icon name="chev" size={14} className="hidden shrink-0 sm:block" /><span className="truncate">{sprint.name}</span></>}
          <Icon name="chev" size={14} className="shrink-0" /><span className="shrink-0 font-semibold text-ink">{task.key}</span>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle className="size-10" />
          <button onClick={() => setEditing(true)} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label="Edit task" title="Edit task"><Icon name="edit" size={18} /></button>
          <button onClick={deleteTask} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger-ink" aria-label="Delete task" title="Delete task"><Icon name="trash" size={18} /></button>
        </div>
      </div>
    </header>

    <main className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-8 lg:gap-y-6 lg:pt-8">
      {/* Title + description */}
      <section>
        <h1 className={`m-0 text-2xl font-bold leading-tight tracking-tight lg:text-[28px] ${taskStatus === "Done" ? "text-muted line-through decoration-faint" : ""}`}>{task.title}</h1>
        {task.description ? <p className="mb-0 mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">{task.description}</p>
          : <button onClick={() => setEditing(true)} className="mt-3 text-sm text-faint hover:text-brand-600">Add a description…</button>}
      </section>

      {/* Details: right column on desktop, directly under the title on phones */}
      <aside className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-24">
          <dl className="m-0 grid gap-3.5 text-sm">
            <Detail label="Status"><StatusSelect value={taskStatus} label="Task status" onChange={(status) => setStatus("task", base, status)} /></Detail>
            <Detail label="Sprint">
              <span className="relative inline-flex max-w-full">
                <select value={sprint?.id ?? ""} disabled={moving} onChange={(event) => moveToSprint(event.target.value)} aria-label="Move task to sprint" className="h-8 max-w-full appearance-none truncate rounded-lg border border-line bg-surface pl-2.5 pr-7 text-right text-[13px] font-medium text-ink outline-none hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand-100 disabled:opacity-60">
                  {!sprint && <option value="">No sprint</option>}
                  {detail.sprints.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status.toLowerCase() === "active" ? " (active)" : ""}</option>)}
                </select>
                <Icon name="down" size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
              </span>
            </Detail>
            <Detail label="Start">{task.startDate ? formatDate(task.startDate) : <span className="text-faint">—</span>}</Detail>
            <Detail label="Deadline">{task.deadline ? <span className="flex flex-wrap items-center justify-end gap-1.5">{formatDate(task.deadline)}{days !== null && days <= 2 && <span suppressHydrationWarning className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${days < 0 ? "bg-danger-soft text-danger-ink" : "bg-warning-soft text-warning-ink"}`}>{dueLabel(days)}</span>}</span> : <span className="text-faint">—</span>}</Detail>
            <Detail label="Subtasks">{subtasks.length ? `${doneCount} of ${subtasks.length} done` : <span className="text-faint">None</span>}</Detail>
            {task.createdAt && <Detail label="Created"><span suppressHydrationWarning>{timeAgo(task.createdAt)}</span></Detail>}
          </dl>
        </div>
      </aside>

      {error && <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink"><span className="flex-1">{error}</span><button onClick={() => setError("")} className="grid size-7 place-items-center rounded-md hover:bg-danger-soft-hover" aria-label="Dismiss"><Icon name="close" size={14} /></button></div>}

      <div className="grid gap-4 lg:gap-6">
        <SubtaskList
          subtasks={subtasks}
          comments={detail.comments}
          doneCount={doneCount}
          currentUserId={user.id}
          onAdd={(title) => run(`${base}/subtasks`, "POST", { title })}
          onRename={(subtask, title) => run(`${base}/subtasks/${subtask.id}`, "PATCH", { title })}
          onStatus={(subtask, status) => setStatus(subtask.id, `${base}/subtasks/${subtask.id}`, status)}
          onDelete={(subtask) => { if (window.confirm(`Delete subtask “${subtask.title}” and its comments?`)) void run(`${base}/subtasks/${subtask.id}`, "DELETE"); }}
          onComment={(subtask, body) => run(`${base}/comments`, "POST", { body, subtaskId: subtask.id })}
          onDeleteComment={deleteComment}
        />

        <CanvasList canvases={detail.canvases} apiBase={base} onError={setError} />

        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <h2 className="m-0 mb-4 flex items-center gap-2 text-base font-semibold"><Icon name="chat" size={18} className="text-muted" />Comments<span className="text-sm font-normal text-faint">{taskComments.length}</span></h2>
          <CommentThread comments={taskComments} currentUserId={user.id} onPost={(body) => run(`${base}/comments`, "POST", { body })} onDelete={deleteComment} />
        </section>
      </div>
    </main>

    {editing && <CreateDialog type="task" task={task} projectName={project.name} onClose={() => setEditing(false)} onCreate={async (title, description, startDate, deadline) => {
      const message = await run(base, "PATCH", { title, description, startDate, deadline });
      if (!message) setEditing(false);
      return message;
    }} />}
  </div>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-h-8 items-center justify-between gap-3"><dt className="shrink-0 text-muted">{label}</dt><dd className="m-0 min-w-0 text-right font-medium text-ink">{children}</dd></div>;
}

type SubtaskListProps = {
  subtasks: Subtask[];
  comments: Comment[];
  doneCount: number;
  currentUserId: string;
  onAdd: (title: string) => Promise<string | null>;
  onRename: (subtask: Subtask, title: string) => Promise<string | null>;
  onStatus: (subtask: Subtask, status: TaskStatus) => void;
  onDelete: (subtask: Subtask) => void;
  onComment: (subtask: Subtask, body: string) => Promise<string | null>;
  onDeleteComment: (comment: Comment) => void;
};

function SubtaskList({ subtasks, comments, doneCount, currentUserId, onAdd, onRename, onStatus, onDelete, onComment, onDeleteComment }: SubtaskListProps) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const percent = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    if (!(await onAdd(title.trim()))) setTitle("");
    setBusy(false);
  }

  return <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
    <div className="mb-3 flex items-center gap-3">
      <h2 className="m-0 flex items-center gap-2 text-base font-semibold"><Icon name="subtask" size={18} className="text-muted" />Subtasks</h2>
      {subtasks.length > 0 && <>
        <div className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${percent}%` }} /></div>
        <span className="text-[13px] text-muted">{doneCount}/{subtasks.length}</span>
      </>}
    </div>

    {subtasks.length > 0 && <ul className="-mx-2 mb-3 grid">
      {subtasks.map((subtask) => <SubtaskRow key={subtask.id} subtask={subtask} comments={comments.filter((comment) => comment.subtaskId === subtask.id)} currentUserId={currentUserId}
        onRename={(value) => onRename(subtask, value)} onStatus={(status) => onStatus(subtask, status)} onDelete={() => onDelete(subtask)}
        onComment={(body) => onComment(subtask, body)} onDeleteComment={onDeleteComment} />)}
    </ul>}

    <form onSubmit={add} className="flex gap-2">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a subtask, e.g. Integrate shipment notification API" aria-label="New subtask title" className="h-11 min-w-0 flex-1 rounded-xl border border-dashed border-line-strong bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-solid focus:border-brand-200 focus:ring-2 focus:ring-brand-100 sm:h-10 sm:text-sm" />
      <button type="submit" disabled={!title.trim() || busy} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10"><Icon name="plus" size={16} /><span className="hidden sm:inline">Add</span></button>
    </form>
  </section>;
}

type SubtaskRowProps = {
  subtask: Subtask;
  comments: Comment[];
  currentUserId: string;
  onRename: (title: string) => Promise<string | null>;
  onStatus: (status: TaskStatus) => void;
  onDelete: () => void;
  onComment: (body: string) => Promise<string | null>;
  onDeleteComment: (comment: Comment) => void;
};

function SubtaskRow({ subtask, comments, currentUserId, onRename, onStatus, onDelete, onComment, onDeleteComment }: SubtaskRowProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.title);
  const done = subtask.status === "Done";

  async function save() {
    const value = draft.trim();
    setEditing(false);
    if (!value || value === subtask.title) { setDraft(subtask.title); return; }
    if (await onRename(value)) setDraft(subtask.title);
  }

  return <li className="group/subtask rounded-xl px-2 hover:bg-canvas">
    <div className="flex min-h-12 items-center gap-2 py-1.5">
      <button onClick={() => onStatus(done ? "To do" : "Done")} className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${done ? "border-success bg-success text-white" : subtask.status === "In progress" ? "border-brand-500 text-brand-500" : "border-line-strong text-transparent hover:border-success hover:text-success"}`} aria-label={done ? `Mark “${subtask.title}” as to do` : `Mark “${subtask.title}” as done`}>
        {subtask.status === "In progress" ? <i className="size-2 rounded-full bg-brand-500" /> : <Icon name="check" size={13} />}
      </button>

      {editing
        ? <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(subtask.title); setEditing(false); } }} aria-label="Subtask title" className="h-9 min-w-0 flex-1 rounded-lg border border-brand-200 bg-surface px-2 text-base outline-none ring-2 ring-brand-100 sm:text-sm" />
        : <button onClick={() => setEditing(true)} title="Click to rename" className={`min-w-0 flex-1 break-words rounded text-left text-sm leading-snug ${done ? "text-muted line-through decoration-faint" : "text-ink"}`}>{subtask.title}</button>}

      <div className="flex shrink-0 items-center gap-0.5">
        <span className="hidden sm:inline-flex"><StatusSelect size="sm" value={subtask.status} label={`Status for ${subtask.title}`} onChange={onStatus} /></span>
        <button onClick={() => setOpen((value) => !value)} aria-expanded={open} className={`flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium ${open ? "bg-brand-50 text-brand-700" : comments.length ? "text-ink-soft hover:bg-surface" : "text-faint hover:bg-surface hover:text-ink-soft"}`} aria-label={`${comments.length} comments on ${subtask.title}`}>
          <Icon name="chat" size={15} />{comments.length > 0 && comments.length}
        </button>
        <button onClick={onDelete} className="grid size-8 place-items-center rounded-lg text-faint transition-opacity hover:bg-danger-soft hover:text-danger-ink focus:opacity-100 can-hover:opacity-0 can-hover:group-hover/subtask:opacity-100" aria-label={`Delete ${subtask.title}`}><Icon name="trash" size={15} /></button>
      </div>
    </div>

    {open && <div className="mb-2 ml-8 border-l-2 border-line pb-2 pl-3 pt-1">
      {/* On phones the status picker lives here to keep the row compact. */}
      <div className="mb-3 flex items-center gap-2 sm:hidden"><span className="text-xs text-muted">Status</span><StatusSelect size="sm" value={subtask.status} label={`Status for ${subtask.title}`} onChange={onStatus} /></div>
      <CommentThread compact comments={comments} currentUserId={currentUserId} placeholder="Comment on this subtask…" onPost={onComment} onDelete={onDeleteComment} />
    </div>}
  </li>;
}
