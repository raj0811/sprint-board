"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import type { Sprint, Task } from "@/lib/board-data";

type CreateDialogProps = {
  type: "project" | "task" | "sprint";
  projectName: string;
  task?: Task;
  sprint?: Sprint;
  /** When editing a task: the project's sprints, so the task can be moved. */
  sprintOptions?: { id: string; name: string; status: string }[];
  currentSprintId?: string;
  /** When editing a project: its current values. */
  project?: { name: string; description: string };
  /** Shows a "Delete …" button in the footer (e.g. when editing a sprint or project). */
  onDelete?: () => void;
  onClose: () => void;
  onCreate: (title: string, description: string, startDate: string, deadline: string, extra?: { sprintId?: string; features?: string[] }) => Promise<string | null>;
};

// 16px text on phones prevents iOS from zooming into focused inputs.
const fieldClass = "w-full rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none transition placeholder:text-faint focus:border-brand-200 focus:ring-2 focus:ring-brand-100 sm:text-sm";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink-soft";

export function CreateDialog({ type, projectName, task, sprint, project, sprintOptions = [], currentSprintId, onDelete, onClose, onCreate }: CreateDialogProps) {
  const [title, setTitle] = useState(task?.title ?? sprint?.name ?? project?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? sprint?.description ?? project?.description ?? "");
  const [startDate, setStartDate] = useState(task?.startDate.slice(0, 10) ?? sprint?.startDate.slice(0, 10) ?? "");
  const [deadline, setDeadline] = useState(task?.deadline.slice(0, 10) ?? sprint?.deadline.slice(0, 10) ?? "");
  const [sprintId, setSprintId] = useState(currentSprintId ?? "");
  const [features, setFeatures] = useState<string[]>([]);
  const [featureDraft, setFeatureDraft] = useState("");

  function addFeature() {
    const value = featureDraft.trim();
    if (!value) return;
    setFeatures((current) => [...current, value]);
    setFeatureDraft("");
  }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(task || sprint || project);
  const heading = editing ? `Edit ${type}` : `New ${type}`;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [busy, onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (startDate && deadline && deadline < startDate) {
      setError("Deadline must be on or after the start date.");
      return;
    }
    setBusy(true);
    setError("");
    const message = await onCreate(title.trim(), description.trim(), startDate, deadline, {
      sprintId: sprintId && sprintId !== currentSprintId ? sprintId : undefined,
      // Include anything still typed in the feature box.
      features: type === "project" && !project ? [...features, featureDraft].map((item) => item.trim()).filter(Boolean) : undefined,
    });
    if (message) setError(message);
    setBusy(false);
  }

  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_20px_70px_#1d1b2940] sm:max-w-[480px] sm:rounded-2xl sm:p-6">
      <div className="mx-auto -mt-1 mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {type !== "project" && <span className="mb-0.5 block truncate text-xs font-medium text-faint">{projectName}</span>}
          <h2 id="dialog-title" className="m-0 text-lg font-semibold tracking-tight">{heading}</h2>
        </div>
        <button type="button" onClick={onClose} disabled={busy} className="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label="Close"><Icon name="close" /></button>
      </div>

      <label htmlFor="item-title" className={labelClass}>Title</label>
      <input autoFocus id="item-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "task" ? "What needs to get done?" : type === "sprint" ? "e.g. Sprint 05" : "e.g. Website redesign"} className={`${fieldClass} h-11`} />

      <div className="mt-4">
        <label htmlFor="item-description" className={labelClass}>Description</label>
        <textarea id="item-description" rows={3} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder={`Describe this ${type}…`} className={`${fieldClass} resize-y py-2.5 leading-relaxed`} />
      </div>

      {type !== "project" && <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0"><label htmlFor="start-date" className={labelClass}>Start date</label><input id="start-date" type="date" value={startDate} max={deadline || undefined} onChange={(event) => setStartDate(event.target.value)} className={`${fieldClass} h-11 min-w-0`} /></div>
        <div className="min-w-0"><label htmlFor="deadline" className={labelClass}>Deadline</label><input id="deadline" type="date" value={deadline} min={startDate || undefined} onChange={(event) => setDeadline(event.target.value)} className={`${fieldClass} h-11 min-w-0`} /></div>
      </div>}

      {type === "project" && !project && <div className="mt-4">
        <label htmlFor="feature-draft" className={labelClass}>Key features <span className="font-normal text-faint">(optional)</span></label>
        {features.length > 0 && <ul className="mb-2 grid gap-1.5">
          {features.map((feature, index) => <li key={`${feature}-${index}`} className="flex items-center gap-2 rounded-lg bg-sunken py-1.5 pl-3 pr-1 text-sm text-ink-soft">
            <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />
            <span className="min-w-0 flex-1 break-words">{feature}</span>
            <button type="button" onClick={() => setFeatures((current) => current.filter((_, position) => position !== index))} className="grid size-7 shrink-0 place-items-center rounded-md text-faint hover:bg-surface hover:text-danger-ink" aria-label={`Remove ${feature}`}><Icon name="close" size={14} /></button>
          </li>)}
        </ul>}
        <div className="flex gap-2">
          <input id="feature-draft" value={featureDraft} onChange={(event) => setFeatureDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addFeature(); } }} maxLength={200} placeholder="e.g. WhatsApp order notifications" className={`${fieldClass} h-11 min-w-0 flex-1`} />
          <button type="button" onClick={addFeature} disabled={!featureDraft.trim()} className="h-11 shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-ink-soft hover:bg-canvas disabled:opacity-40">Add</button>
        </div>
        <p className="mb-0 mt-1.5 text-xs text-muted">Press Enter to add each one. You can add more and tick them off later.</p>
      </div>}

      {task && sprintOptions.length > 1 && <div className="mt-4">
        <label htmlFor="task-sprint" className={labelClass}>Sprint</label>
        <div className="relative">
          <select id="task-sprint" value={sprintId} onChange={(event) => setSprintId(event.target.value)} className={`${fieldClass} h-11 appearance-none pr-9`}>
            {sprintOptions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status.toLowerCase() === "active" ? " (active)" : ""}</option>)}
          </select>
          <Icon name="down" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>
        {sprintId !== currentSprintId && <p className="mb-0 mt-1.5 text-xs text-muted">The task will move to this sprint when you save.</p>}
      </div>}

      {error && <p role="alert" className="mb-0 mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">{error}</p>}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onDelete && <button type="button" disabled={busy} onClick={onDelete} className="flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger-ink hover:bg-danger-soft sm:mr-auto sm:h-10"><Icon name="trash" size={16} />Delete {type}</button>}
        <button type="button" disabled={busy} onClick={onClose} className="h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft hover:bg-canvas sm:h-10">Cancel</button>
        <button type="submit" disabled={busy} className="h-11 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60 sm:h-10">{busy ? "Saving…" : editing ? "Save changes" : `Create ${type}`}</button>
      </div>
    </form>
  </div>;
}
