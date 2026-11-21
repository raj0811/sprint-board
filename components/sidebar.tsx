"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripHandle, sortableStyle, useDragSensors } from "@/components/ui/sortable";
import { send } from "@/lib/api-client";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { initialsOf } from "@/lib/format";
import type { ProjectOption } from "@/lib/board-data";

type SidebarProps = {
  projects: ProjectOption[];
  selectedProjectId?: string;
  userName: string;
  userEmail: string;
  open: boolean;
  onClose: () => void;
  onAddProject: () => void;
};

const projectColors = ["bg-[#9278f2]", "bg-[#5fb6e0]", "bg-[#f19a6f]", "bg-[#5cc39a]", "bg-[#e07fb4]", "bg-[#e5bf4f]"];

export function Sidebar({ projects, selectedProjectId, userName, userEmail, open, onClose, onAddProject }: SidebarProps) {
  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return <>
    <div aria-hidden="true" onClick={onClose} className={`fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
    <aside className={`fixed top-0 bottom-0 left-0 z-50 lg:bottom-auto flex w-[280px] max-w-[85vw] flex-col border-r border-line bg-surface pb-[env(safe-area-inset-bottom)] transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[260px] lg:translate-x-0 ${open ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid size-8 place-items-center rounded-[10px] bg-brand-500 text-white shadow-sm shadow-brand-500/30"><Icon name="spark" size={18} /></span>Sprint Board</div>
        <button onClick={onClose} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas lg:hidden" aria-label="Close menu"><Icon name="close" /></button>
      </div>

      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Projects</span>
        <button onClick={() => { onAddProject(); onClose(); }} className="grid size-7 place-items-center rounded-md text-muted hover:bg-brand-50 hover:text-brand-600" aria-label="New project"><Icon name="plus" size={16} /></button>
      </div>
      <nav aria-label="Projects" className="min-h-0 flex-1 overflow-y-auto px-3">
        {projects.length ? <ProjectList projects={projects} selectedProjectId={selectedProjectId} onNavigate={onClose} /> : <button onClick={() => { onAddProject(); onClose(); }} className="mx-1 mt-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg border border-dashed border-line px-3 py-3 text-left text-sm text-muted hover:border-brand-200 hover:text-brand-600"><Icon name="plus" size={16} />Create your first project</button>}
      </nav>

      <div className="flex shrink-0 items-center gap-3 border-t border-line px-4 py-3">
        <Avatar initials={initialsOf(userName)} color="plum" />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{userName}</div><div className="truncate text-xs text-muted">{userEmail}</div></div>
        <form action="/api/auth/logout" method="post"><button className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label="Sign out" title="Sign out"><Icon name="logout" size={18} /></button></form>
      </div>
    </aside>
  </>;
}

/** A stable colour per project, so reordering doesn't reshuffle colours. */
function colorFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return projectColors[hash % projectColors.length];
}

/** Sidebar projects; drag the handle to set your own order (saved per user). */
function ProjectList({ projects, selectedProjectId, onNavigate }: { projects: ProjectOption[]; selectedProjectId?: string; onNavigate: () => void }) {
  const router = useRouter();
  const sensors = useDragSensors();
  const [error, setError] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [seen, setSeen] = useState(projects);
  if (seen !== projects) {
    setSeen(projects);
    setOrder(null);
  }
  const byId = new Map(projects.map((project) => [project.id, project]));
  const items = order ? order.flatMap((id) => byId.get(id) ?? []) : projects;

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = items.map((project) => project.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrder(next);
    const result = await send("/api/projects/order", "PUT", { ids: next });
    if (result.error) {
      setOrder(null);
      setError(result.error);
    } else {
      setError("");
      router.refresh();
    }
  }

  return <>
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((project) => project.id)} strategy={verticalListSortingStrategy}>
        <ul className="grid gap-0.5">
          {items.map((project) => <ProjectRow key={project.id} project={project} active={project.id === selectedProjectId} onNavigate={onNavigate} />)}
        </ul>
      </SortableContext>
    </DndContext>
    {error && <p role="alert" className="mx-3 mt-2 text-xs text-danger-ink">{error}</p>}
  </>;
}

function ProjectRow({ project, active, onNavigate }: { project: ProjectOption; active: boolean; onNavigate: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  return <li ref={setNodeRef} style={sortableStyle(transform, transition)} className={`group/project relative flex items-center rounded-lg ${isDragging ? "z-10 bg-surface shadow-lg ring-1 ring-line-strong" : ""}`}>
    <Link href={`/?project=${project.id}`} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex h-10 min-w-0 flex-1 items-center gap-3 rounded-lg pl-3 pr-9 text-sm transition-colors ${active ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-soft hover:bg-canvas"}`}>
      <span className={`size-2.5 shrink-0 rounded-[3px] ${colorFor(project.id)}`} />
      <span className="min-w-0 flex-1 truncate">{project.name}</span>
      {project.shared && <span title="Shared with you" className="shrink-0 text-faint"><Icon name="users" size={14} /></span>}
    </Link>
    <GripHandle label={`Reorder ${project.name}`} attributes={attributes} listeners={listeners} className="absolute right-1 size-8 transition-opacity focus:opacity-100 can-hover:opacity-0 can-hover:group-hover/project:opacity-100" />
  </li>;
}
