"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";

type DeleteDialogProps = {
  kind: "project" | "sprint";
  name: string;
  /** Sprint deletion: number of tasks in the sprint and the sprints they could move to. */
  taskCount?: number;
  otherSprints?: { id: string; name: string }[];
  onConfirm: (options: { moveTo?: string }) => Promise<string | null>;
  onClose: () => void;
};

export function DeleteDialog({ kind, name, taskCount = 0, otherSprints = [], onConfirm, onClose }: DeleteDialogProps) {
  const canMove = kind === "sprint" && taskCount > 0 && otherSprints.length > 0;
  const [mode, setMode] = useState<"move" | "delete">(canMove ? "move" : "delete");
  const [moveTo, setMoveTo] = useState(otherSprints[0]?.id ?? "");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Deleting a whole project is confirmed by typing its name.
  const confirmed = kind === "project" ? typed.trim() === name.trim() : true;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [busy, onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError("");
    const message = await onConfirm(mode === "move" && canMove ? { moveTo } : {});
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  const tasksLabel = `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`;

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-overlay backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form onSubmit={submit} role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_20px_70px_#0000004d] sm:max-w-[460px] sm:rounded-2xl sm:p-6">
      <div className="mx-auto -mt-1 mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger-ink"><Icon name="trash" size={19} /></span>
        <div className="min-w-0">
          <h2 id="delete-title" className="m-0 text-lg font-semibold tracking-tight">Delete {kind}?</h2>
          <p className="mb-0 mt-1 break-words text-sm text-muted">“{name}”</p>
        </div>
      </div>

      {kind === "project" ? <>
        <p className="mb-0 mt-4 text-sm leading-relaxed text-ink-soft">This permanently deletes the project with all of its sprints, tasks, subtasks, comments, canvases and key features — for everyone on the team. This cannot be undone.</p>
        <label htmlFor="confirm-name" className="mb-1.5 mt-4 block text-[13px] font-semibold text-ink-soft">Type <span className="text-ink">{name}</span> to confirm</label>
        <input id="confirm-name" autoFocus autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none focus:border-danger-ink/50 focus:ring-2 focus:ring-danger-soft sm:text-sm" />
      </> : taskCount === 0
        ? <p className="mb-0 mt-4 text-sm leading-relaxed text-ink-soft">This sprint has no tasks. It will be removed permanently.</p>
        : <fieldset className="m-0 mt-4 grid gap-2 border-0 p-0">
          <legend className="mb-2 text-sm text-ink-soft">This sprint has <strong className="font-semibold text-ink">{tasksLabel}</strong>. What should happen to {taskCount === 1 ? "it" : "them"}?</legend>
          {canMove && <label className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3 ${mode === "move" ? "border-brand-200 bg-brand-50" : "border-line"}`}>
            <span className="flex items-center gap-2.5 text-sm font-medium"><input type="radio" name="mode" checked={mode === "move"} onChange={() => setMode("move")} className="accent-brand-500" />Move {taskCount === 1 ? "it" : "them"} to another sprint</span>
            {mode === "move" && <span className="relative ml-6 block">
              <select value={moveTo} onChange={(event) => setMoveTo(event.target.value)} aria-label="Sprint to move tasks to" className="h-10 w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-base text-ink outline-none focus:ring-2 focus:ring-brand-100 sm:text-sm">
                {otherSprints.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <Icon name="down" size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
            </span>}
          </label>}
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm ${mode === "delete" ? "border-danger-ink/40 bg-danger-soft" : "border-line"}`}>
            <input type="radio" name="mode" checked={mode === "delete"} onChange={() => setMode("delete")} className="mt-0.5 accent-[var(--color-danger-ink)]" />
            <span><span className="font-medium">Delete {taskCount === 1 ? "the task" : `all ${tasksLabel}`} too</span><span className="mt-0.5 block text-xs text-muted">Including their subtasks, comments and canvases.</span></span>
          </label>
        </fieldset>}

      {error && <p role="alert" className="mb-0 mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">{error}</p>}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" disabled={busy} onClick={onClose} className="h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft hover:bg-canvas sm:h-10">Cancel</button>
        <button type="submit" disabled={!confirmed || busy} className="h-11 rounded-xl bg-[#d4493f] px-5 text-sm font-semibold text-white hover:bg-[#bd3d34] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10">
          {busy ? "Deleting…" : kind === "sprint" && mode === "move" && canMove ? "Move tasks & delete sprint" : `Delete ${kind}`}
        </button>
      </div>
    </form>
  </div>;
}
