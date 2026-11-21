import { Icon } from "@/components/ui/icon";
import type { TaskStatus } from "@/lib/board-data";

export const statusStyles: Record<TaskStatus, string> = {
  "To do": "bg-sunken text-ink-soft", "In progress": "bg-brand-50 text-brand-700", Done: "bg-success-soft text-success-ink",
};

export function StatusSelect({ value, onChange, label, size = "md" }: { value: TaskStatus; onChange: (status: TaskStatus) => void; label: string; size?: "sm" | "md" }) {
  return <span className="relative inline-flex shrink-0">
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as TaskStatus)} className={`appearance-none rounded-lg border-0 pl-2.5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${size === "sm" ? "h-7 pr-6 text-[11px]" : "h-8 pr-7 text-xs"} ${statusStyles[value]}`}>
      <option>To do</option><option>In progress</option><option>Done</option>
    </select>
    <Icon name="down" size={size === "sm" ? 12 : 13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-70" />
  </span>;
}
