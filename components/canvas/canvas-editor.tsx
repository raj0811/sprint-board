"use client";

import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState, ExcalidrawProps } from "@excalidraw/excalidraw/types";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle, useIsDark } from "@/components/ui/theme-toggle";
import { send } from "@/lib/api-client";
import type { CanvasDocument } from "@/lib/canvas";

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");
type SceneElements = Parameters<NonNullable<ExcalidrawProps["onChange"]>>[0];
type SaveState = "saved" | "unsaved" | "saving" | "error";

const AUTOSAVE_DELAY = 1200;

export function CanvasEditor({ canvas }: { canvas: CanvasDocument }) {
  const dark = useIsDark();
  const [lib, setLib] = useState<ExcalidrawModule | null>(null);
  const [title, setTitle] = useState(canvas.title);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSignature = useRef<string | null>(null);
  const dirty = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const url = `/api/projects/${canvas.projectId}/tasks/${canvas.task.id}/canvases/${canvas.id}`;
  const taskHref = `/tasks/${canvas.task.id}`;

  // Excalidraw touches `window`, so it's loaded only in the browser.
  useEffect(() => {
    let cancelled = false;
    void import("@excalidraw/excalidraw").then((mod) => { if (!cancelled) setLib(mod); });
    return () => { cancelled = true; };
  }, []);

  const signatureOf = useCallback((elements: SceneElements, background: string, fileCount: number) =>
    lib ? `${lib.getSceneVersion(elements)}|${background}|${fileCount}` : "", [lib]);

  const save = useCallback(async () => {
    const api = apiRef.current;
    if (!api || !lib) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (saving.current) await saving.current;

    const run = async () => {
      const elements = lib.getNonDeletedElements(api.getSceneElements());
      const appState = api.getAppState();
      const allFiles = api.getFiles();
      // Keep only images still used on the canvas.
      const usedIds = new Set<string>(elements.flatMap((element) => element.type === "image" && element.fileId ? [String(element.fileId)] : []));
      const files = Object.fromEntries(Object.entries(allFiles).filter(([id]) => usedIds.has(id)));
      const signature = signatureOf(api.getSceneElements(), appState.viewBackgroundColor, Object.keys(allFiles).length);

      let previewSvg = "";
      try {
        if (elements.length) {
          const svg = await lib.exportToSvg({
            elements,
            appState: { ...appState, exportBackground: true, exportWithDarkMode: false },
            files: null,
            exportPadding: 16,
            skipInliningFonts: true,
          });
          previewSvg = svg.outerHTML;
        }
      } catch { /* preview is optional */ }

      setSaveState("saving");
      const result = await send(url, "PATCH", { elements, files, viewBackgroundColor: appState.viewBackgroundColor, previewSvg });
      if (result.error) {
        setSaveState("error");
        setError(result.error);
        return;
      }
      savedSignature.current = signature;
      dirty.current = false;
      setError("");
      setSaveState("saved");
    };
    saving.current = run().finally(() => { saving.current = null; });
    await saving.current;
  }, [lib, signatureOf, url]);

  const onChange: NonNullable<ExcalidrawProps["onChange"]> = (elements, appState, files) => {
    const signature = signatureOf(elements, appState.viewBackgroundColor, Object.keys(files).length);
    if (savedSignature.current === null) { savedSignature.current = signature; return; } // initial load
    if (signature === savedSignature.current) return; // selection, scrolling, zoom: nothing to save
    dirty.current = true;
    setSaveState("unsaved");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void save(); }, AUTOSAVE_DELAY);
  };

  // Ctrl/⌘+S saves now; warn before closing the tab with unsaved changes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        void save();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault(); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [save]);

  async function saveTitle() {
    const value = title.trim();
    if (!value) { setTitle(canvas.title); return; }
    if (value === canvas.title) return;
    const result = await send(url, "PATCH", { title: value });
    if (result.error) setError(result.error);
  }

  const status = { saved: "Saved", unsaved: "Unsaved changes", saving: "Saving…", error: "Not saved" }[saveState];
  const initialData: ExcalidrawInitialDataState = {
    elements: canvas.elements as ExcalidrawInitialDataState["elements"],
    files: canvas.files as ExcalidrawInitialDataState["files"],
    appState: { viewBackgroundColor: canvas.viewBackgroundColor },
    scrollToContent: true,
  };

  return <div className="flex h-dvh flex-col bg-canvas text-ink">
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 pt-[env(safe-area-inset-top)] sm:px-4">
      <Link href={taskHref} onClick={() => { if (dirty.current) void save(); }} className="flex h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-soft hover:bg-canvas" title={`Back to ${canvas.task.key}`}>
        <Icon name="back" size={18} /><span className="hidden sm:inline">{canvas.task.key}</span>
      </Link>
      <input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={saveTitle} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label="Canvas title" maxLength={200} className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base font-semibold outline-none hover:bg-canvas focus:bg-canvas focus:ring-2 focus:ring-brand-100 sm:max-w-md sm:text-sm" />
      <span role="status" title={error || undefined} className={`ml-auto hidden shrink-0 items-center gap-1.5 text-xs sm:flex ${saveState === "error" ? "text-danger-ink" : "text-muted"}`}>
        <i className={`size-1.5 rounded-full ${saveState === "saved" ? "bg-success" : saveState === "error" ? "bg-danger-ink" : "bg-warning-ink"}`} />{status}
      </span>
      <button onClick={() => void save()} disabled={saveState === "saving"} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60 sm:ml-0">
        <Icon name="check" size={15} /><span className="sm:hidden">{saveState === "saved" ? "Saved" : "Save"}</span><span className="hidden sm:inline">Save</span>
      </button>
      <ThemeToggle className="size-9 shrink-0" />
    </header>
    {error && <p role="alert" className="m-0 bg-danger-soft px-4 py-2 text-sm text-danger-ink">{error}</p>}

    <div className="relative min-h-0 flex-1">
      {lib ? <div className="absolute inset-0">
        <lib.Excalidraw
          excalidrawAPI={(api) => { apiRef.current = api; }}
          initialData={initialData}
          onChange={onChange}
          theme={dark ? "dark" : "light"}
          name={title}
          UIOptions={{ canvasActions: { toggleTheme: false, loadScene: false, saveToActiveFile: false, export: false } }}
        >
          <lib.MainMenu>
            <lib.MainMenu.DefaultItems.SaveAsImage />
            <lib.MainMenu.DefaultItems.SearchMenu />
            <lib.MainMenu.DefaultItems.ClearCanvas />
            <lib.MainMenu.Separator />
            <lib.MainMenu.DefaultItems.ChangeCanvasBackground />
            <lib.MainMenu.DefaultItems.Help />
          </lib.MainMenu>
          <lib.WelcomeScreen>
            <lib.WelcomeScreen.Hints.ToolbarHint />
            <lib.WelcomeScreen.Hints.HelpHint />
            <lib.WelcomeScreen.Center>
              <lib.WelcomeScreen.Center.Heading>Sketch flows, boxes and arrows for {canvas.task.key}. Changes save automatically.</lib.WelcomeScreen.Center.Heading>
            </lib.WelcomeScreen.Center>
          </lib.WelcomeScreen>
        </lib.Excalidraw>
      </div> : <div className="grid h-full place-items-center text-sm text-muted">Loading canvas…</div>}
    </div>
  </div>;
}
