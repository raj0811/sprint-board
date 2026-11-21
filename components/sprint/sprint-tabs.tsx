"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { Icon } from "@/components/ui/icon";
import { sortableStyle, useDragSensors } from "@/components/ui/sortable";
import { send } from "@/lib/api-client";
import type { Sprint } from "@/lib/board-data";

type SprintTabsProps = {
  projectId: string;
  sprints: Sprint[];
  selectedId?: string;
  onSelect: (sprintId: string) => void;
  onCreate: () => void;
  onError: (message: string) => void;
};

/** Sprint switcher. Drag tabs sideways (or press-and-hold on touch) to change the sprint sequence. */
export function SprintTabs({ projectId, sprints, selectedId, onSelect, onCreate, onError }: SprintTabsProps) {
  const router = useRouter();
  const sensors = useDragSensors();
  const justDragged = useRef(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [seen, setSeen] = useState(sprints);
  if (seen !== sprints) {
    setSeen(sprints);
    setOrder(null);
  }
  const byId = new Map(sprints.map((sprint) => [sprint.id, sprint]));
  const items = order ? order.flatMap((id) => byId.get(id) ?? []) : sprints;

  async function onDragEnd({ active, over }: DragEndEvent) {
    // A drag ends with a click on the same tab; ignore it so dragging doesn't switch sprints.
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 0);
    if (!over || active.id === over.id) return;
    const ids = items.map((sprint) => sprint.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrder(next);
    const result = await send(`/api/projects/${projectId}/sprints/order`, "PUT", { ids: next });
    if (result.error) {
      setOrder(null);
      onError(result.error);
    } else router.refresh();
  }

  return <div className="no-scrollbar -mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToHorizontalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((sprint) => sprint.id)} strategy={horizontalListSortingStrategy}>
        <ol className="flex items-center gap-2" aria-label="Sprints">
          {items.map((sprint, index) => <SprintTab key={sprint.id} sprint={sprint} position={index + 1} selected={sprint.id === selectedId}
            onSelect={() => { if (!justDragged.current) onSelect(sprint.id); }} />)}
        </ol>
      </SortableContext>
    </DndContext>
    <button onClick={onCreate} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3 text-sm font-medium text-muted hover:border-brand-200 hover:text-brand-600"><Icon name="plus" size={16} />New sprint</button>
  </div>;
}

function SprintTab({ sprint, position, selected, onSelect }: { sprint: Sprint; position: number; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sprint.id });
  const active = sprint.status.toLowerCase() === "active";
  return <li ref={setNodeRef} style={sortableStyle(transform, transition)} className={`shrink-0 ${isDragging ? "relative z-10" : ""}`}>
    <button {...attributes} {...listeners} onClick={onSelect} aria-current={selected ? "true" : undefined} title="Click to open · drag to reorder"
      className={`flex h-10 max-w-[220px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors active:cursor-grabbing ${selected ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-soft hover:border-line-strong"} ${isDragging ? "shadow-lg" : ""}`}>
      <span className={`text-xs ${selected ? "text-brand-600" : "text-faint"}`}>{position}</span>
      <span className="truncate">{sprint.name}</span>
      {active && <span title="Active sprint" className="size-2 shrink-0 rounded-full bg-success" />}
    </button>
  </li>;
}
