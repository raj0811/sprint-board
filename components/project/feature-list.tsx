"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Icon } from "@/components/ui/icon";
import { GripHandle, sortableStyle, useDragSensors } from "@/components/ui/sortable";
import { send } from "@/lib/api-client";
import type { Feature } from "@/lib/features";

type FeatureListProps = { projectId: string; features: Feature[] };

export function FeatureList({ projectId, features }: FeatureListProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = `/api/projects/${projectId}/features`;

  const sensors = useDragSensors();

  // Optimistic done/undone and order; both are dropped once fresh data arrives.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [order, setOrder] = useState<string[] | null>(null);
  const [seen, setSeen] = useState(features);
  if (seen !== features) {
    setSeen(features);
    setOverrides({});
    setOrder(null);
  }
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const ordered = order ? order.flatMap((id) => byId.get(id) ?? []) : features;
  const items = ordered.map((feature) => feature.id in overrides ? { ...feature, done: overrides[feature.id] } : feature);
  const doneCount = items.filter((feature) => feature.done).length;
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  async function request(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: Record<string, unknown>) {
    const result = await send(url, method, body);
    if (result.error) { setError(result.error); return false; }
    setError("");
    router.refresh();
    return true;
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    if (await request(base, "POST", { title: draft.trim() })) setDraft("");
    setBusy(false);
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = items.map((feature) => feature.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrder(next);
    if (!(await request(`${base}/order`, "PUT", { ids: next }))) setOrder(null);
  }

  async function toggle(feature: Feature) {
    setOverrides((current) => ({ ...current, [feature.id]: !feature.done }));
    if (!(await request(`${base}/${feature.id}`, "PATCH", { done: !feature.done }))) {
      setOverrides((current) => {
        const next = { ...current };
        delete next[feature.id];
        return next;
      });
    }
  }

  return <section className="mb-5 rounded-2xl border border-line bg-surface shadow-sm lg:mb-6">
    <button onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left sm:px-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500"><Icon name="spark" size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Key features</span>
        <span className="block text-xs text-muted">{items.length ? `${doneCount} of ${items.length} complete` : "List what this project needs to deliver"}</span>
      </span>
      {items.length > 0 && <span className="hidden w-32 items-center gap-2 sm:flex"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-success transition-all duration-500" style={{ width: `${percent}%` }} /></span><span className="w-9 text-right text-xs text-muted">{percent}%</span></span>}
      <Icon name="down" size={18} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
    </button>

    {open && <div className="border-t border-line px-2 pb-3 pt-2 sm:px-3">
      {items.length > 0 && <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((feature) => feature.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid">
            {items.map((feature) => <FeatureRow key={feature.id} feature={feature}
              onToggle={() => toggle(feature)}
              onRename={(title) => request(`${base}/${feature.id}`, "PATCH", { title })}
              onDelete={() => { if (window.confirm(`Delete feature “${feature.title}”?`)) void request(`${base}/${feature.id}`, "DELETE"); }} />)}
          </ul>
        </SortableContext>
      </DndContext>}
      <form onSubmit={add} className="mt-1 flex gap-2 px-2">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={200} placeholder="Add a key feature, e.g. COD order confirmation" aria-label="New feature" className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-line-strong bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-solid focus:border-brand-200 focus:ring-2 focus:ring-brand-100 sm:text-sm" />
        <button type="submit" disabled={!draft.trim() || busy} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="plus" size={16} /><span className="hidden sm:inline">Add</span></button>
      </form>
      {error && <p role="alert" className="mx-2 mb-0 mt-2 text-xs text-danger-ink">{error}</p>}
    </div>}
  </section>;
}

function FeatureRow({ feature, onToggle, onRename, onDelete }: { feature: Feature; onToggle: () => void; onRename: (title: string) => Promise<boolean>; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(feature.title);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: feature.id });

  async function save() {
    const value = draft.trim();
    setEditing(false);
    if (!value || value === feature.title) { setDraft(feature.title); return; }
    if (!(await onRename(value))) setDraft(feature.title);
  }

  return <li ref={setNodeRef} style={sortableStyle(transform, transition)} className={`group/feature relative flex min-h-11 items-center gap-1.5 rounded-xl pl-0.5 pr-2 hover:bg-canvas ${isDragging ? "z-10 bg-surface shadow-lg ring-1 ring-line-strong" : ""}`}>
    <GripHandle label={`Reorder ${feature.title}`} attributes={attributes} listeners={listeners} className="size-8" />
    <button onClick={onToggle} role="checkbox" aria-checked={feature.done} aria-label={`Mark “${feature.title}” as ${feature.done ? "not done" : "done"}`} className={`grid size-[22px] shrink-0 place-items-center rounded-md border-2 transition-colors ${feature.done ? "border-success bg-success text-white" : "border-line-strong text-transparent hover:border-success hover:text-success"}`}>
      <Icon name="check" size={13} />
    </button>
    {editing
      ? <input autoFocus value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(feature.title); setEditing(false); } }} aria-label="Feature" className="h-9 min-w-0 flex-1 rounded-lg border border-brand-200 bg-surface px-2 text-base outline-none ring-2 ring-brand-100 sm:text-sm" />
      : <button onClick={() => setEditing(true)} title="Click to rename" className={`min-w-0 flex-1 break-words py-2 text-left text-sm leading-snug ${feature.done ? "text-muted line-through decoration-faint" : "text-ink"}`}>{feature.title}</button>}
    {feature.done && !editing && <span className="hidden rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success-ink sm:inline">Done</span>}
    <button onClick={onDelete} className="grid size-8 shrink-0 place-items-center rounded-lg text-faint transition-opacity hover:bg-danger-soft hover:text-danger-ink focus:opacity-100 can-hover:opacity-0 can-hover:group-hover/feature:opacity-100" aria-label={`Delete ${feature.title}`}><Icon name="trash" size={15} /></button>
  </li>;
}
