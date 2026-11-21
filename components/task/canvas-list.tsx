"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { send } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import type { CanvasSummary } from "@/lib/canvas";

type CanvasListProps = { canvases: CanvasSummary[]; apiBase: string; onError: (message: string) => void };

export function CanvasList({ canvases, apiBase, onError }: CanvasListProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    const result = await send(`${apiBase}/canvases`, "POST", { title: `Canvas ${canvases.length + 1}` });
    if (result.error || !result.id) {
      onError(result.error ?? "Unable to create the canvas.");
      setCreating(false);
      return;
    }
    router.push(`/canvas/${result.id}`);
  }

  async function remove(canvas: CanvasSummary) {
    if (!window.confirm(`Delete canvas “${canvas.title}”? This cannot be undone.`)) return;
    const result = await send(`${apiBase}/canvases/${canvas.id}`, "DELETE");
    if (result.error) onError(result.error);
    else router.refresh();
  }

  return <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
    <div className="mb-3 flex items-center gap-2">
      <h2 className="m-0 flex items-center gap-2 text-base font-semibold"><Icon name="canvas" size={18} className="text-muted" />Canvases<span className="text-sm font-normal text-faint">{canvases.length}</span></h2>
      <button onClick={create} disabled={creating} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink-soft hover:border-line-strong hover:bg-canvas disabled:opacity-60"><Icon name="plus" size={16} />{creating ? "Creating…" : "New canvas"}</button>
    </div>

    {canvases.length === 0
      ? <button onClick={create} disabled={creating} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted hover:border-brand-200 hover:text-brand-600">
          <Icon name="canvas" size={24} />
          <span>Draw a flowchart, wireframe or architecture diagram for this task.</span>
        </button>
      : <ul className="grid gap-3 sm:grid-cols-2">
          {canvases.map((canvas) => <li key={canvas.id} className="group relative overflow-hidden rounded-xl border border-line bg-surface transition hover:border-line-strong hover:shadow-md">
            <div className="grid aspect-[16/9] place-items-center overflow-hidden border-b border-line bg-white p-2">
              {canvas.previewSvg
                // Previews render as images, so their content can't run scripts. Inverted in dark mode to match the theme.
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(canvas.previewSvg)}`} alt="" className="max-h-full max-w-full object-contain dark:hue-rotate-180 dark:invert" />
                : <span className="text-[#a7a5b2]"><Icon name="canvas" size={28} /></span>}
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/canvas/${canvas.id}`} className="block truncate text-sm font-semibold text-ink after:absolute after:inset-0">{canvas.title}</Link>
                <span suppressHydrationWarning className="block truncate text-xs text-muted">Edited {timeAgo(canvas.updatedAt)}{canvas.updatedByName && ` by ${canvas.updatedByName}`}</span>
              </div>
              <button onClick={() => remove(canvas)} className="relative z-10 grid size-8 shrink-0 place-items-center rounded-lg text-faint transition-opacity hover:bg-danger-soft hover:text-danger-ink focus:opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100" aria-label={`Delete ${canvas.title}`}><Icon name="trash" size={15} /></button>
            </div>
          </li>)}
        </ul>}
  </section>;
}
