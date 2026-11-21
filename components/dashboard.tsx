"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateDialog, type CreateExtra } from "@/components/dialogs/create-dialog";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { TeamDialog } from "@/components/dialogs/team-dialog";
import { FeatureList } from "@/components/project/feature-list";
import { ProjectOverview } from "@/components/project/project-overview";
import { Sidebar } from "@/components/sidebar";
import { SprintBoard, type BoardColumns, type StatusFilter } from "@/components/sprint/sprint-board";
import { Topbar } from "@/components/topbar";
import { Icon } from "@/components/ui/icon";
import type { BoardData, Sprint, Task, TaskStatus } from "@/lib/board-data";
import { useStoredString } from "@/lib/use-stored-value";
import { send } from "@/lib/api-client";
import { uploadImages } from "@/lib/upload-client";

type DashboardProps = { board: BoardData; user: { id: string; name: string; email: string } };
type DialogState = { type: "project" | "task" | "sprint"; task?: Task; sprint?: Sprint; editProject?: boolean };
type DeleteState = { kind: "project" } | { kind: "sprint"; sprint: Sprint };

export function Dashboard({ board, user }: DashboardProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [actionError, setActionError] = useState("");
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [collapsedPref, setCollapsedPref] = useStoredString("sidebar-collapsed");
  const sidebarCollapsed = collapsedPref === "1";
  const toggleSidebar = useCallback(() => setCollapsedPref(sidebarCollapsed ? null : "1"), [sidebarCollapsed, setCollapsedPref]);

  // Ctrl/⌘+B collapses or expands the desktop sidebar.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  // Optimistic status changes: show the new column immediately, drop the overrides once fresh server data arrives.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [seenTasks, setSeenTasks] = useState(board.tasks);
  if (seenTasks !== board.tasks) {
    setSeenTasks(board.tasks);
    setStatusOverrides({});
  }
  const tasks = useMemo(() => board.tasks.map((task) => statusOverrides[task.id] ? { ...task, status: statusOverrides[task.id] } : task), [board.tasks, statusOverrides]);

  async function mutate(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: Record<string, unknown>): Promise<string | null> {
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json() as { error?: string; id?: string };
      if (!response.ok) return result.error ?? "Unable to save. Please try again.";
      if (url === "/api/projects" && result.id) router.replace(`/?project=${result.id}`);
      else if (url.endsWith("/sprints") && result.id && board.project) router.replace(`/?project=${board.project.id}&sprint=${result.id}`);
      else router.refresh();
      setActionError("");
      return null;
    } catch {
      return "Could not connect. Please try again.";
    }
  }

  async function createOrUpdateItem(title: string, description: string, startDate: string, deadline: string, extra?: CreateExtra): Promise<string | null> {
    if (!dialog) return "Close this form and try again.";
    let url: string;
    let method: "POST" | "PATCH" = "POST";
    if (dialog.type === "project") {
      if (dialog.editProject && board.project) {
        url = `/api/projects/${board.project.id}`;
        method = "PATCH";
      } else url = "/api/projects";
    } else if (dialog.type === "sprint") {
      if (!board.project) return "Create a project first.";
      if (dialog.sprint) {
        url = `/api/projects/${board.project.id}/sprints/${dialog.sprint.id}`;
        method = "PATCH";
      } else {
        url = `/api/projects/${board.project.id}/sprints`;
      }
    } else {
      if (!board.project) return "Create a project first.";
      if (dialog.task) {
        url = `/api/projects/${board.project.id}/tasks/${dialog.task.id}`;
        method = "PATCH";
      } else {
        if (!board.sprint) return "Create a sprint first.";
        url = `/api/projects/${board.project.id}/tasks`;
      }
    }
    const body = {
      title, description, startDate, deadline,
      ...(dialog.type === "task" && dialog.task && extra?.sprintId ? { sprintId: extra.sprintId } : {}),
      ...(dialog.type === "project" && extra?.features?.length ? { features: extra.features } : {}),
      ...(dialog.type === "task" && !dialog.task && board.sprint ? { sprintId: board.sprint.id } : {}),
    };
    const saved = await send(url, method, body);
    if (saved.error) return saved.error;

    // Then upload any logo / images, now that the item exists.
    const id = method === "POST" ? saved.id : dialog.type === "project" ? board.project?.id : dialog.type === "sprint" ? dialog.sprint?.id : dialog.task?.id;
    let uploadError: string | undefined;
    if (id && dialog.type === "project" && extra?.logo) {
      const logoUrl = `/api/projects/${id}/logo`;
      uploadError = (extra.logo === "remove" ? await send(logoUrl, "DELETE") : await uploadImages(logoUrl, [extra.logo])).error;
    } else if (id && dialog.type !== "project" && extra?.images?.length && board.project) {
      uploadError = (await uploadImages(`/api/projects/${board.project.id}/${dialog.type === "sprint" ? "sprints" : "tasks"}/${id}/images`, extra.images)).error;
    }

    if (url === "/api/projects" && saved.id) router.replace(`/?project=${saved.id}`);
    else if (url.endsWith("/sprints") && saved.id && board.project) router.replace(`/?project=${board.project.id}&sprint=${saved.id}`);
    else router.refresh();
    setActionError(uploadError ? `Saved, but the ${dialog.type === "project" ? "logo" : "images"} couldn't be uploaded: ${uploadError}` : "");
    setDialog(null);
    return null;
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    if (!board.project) return;
    setStatusOverrides((current) => ({ ...current, [taskId]: status }));
    const error = await mutate(`/api/projects/${board.project.id}/tasks/${taskId}`, "PATCH", { status });
    if (error) {
      setActionError(error);
      setStatusOverrides((current) => {
        const next = { ...current };
        delete next[taskId];
        return next;
      });
    }
  }

  async function reorderTasks(columns: BoardColumns) {
    if (!board.project || !board.sprint) return;
    const error = await mutate(`/api/projects/${board.project.id}/tasks/order`, "PUT", { sprintId: board.sprint.id, columns });
    if (error) {
      setActionError(error);
      router.refresh(); // put cards back where the server has them
    }
  }

  async function confirmDelete(options: { moveTo?: string }): Promise<string | null> {
    if (!deleting || !board.project) return "Nothing to delete.";
    const projectId = board.project.id;
    const url = deleting.kind === "project"
      ? `/api/projects/${projectId}`
      : `/api/projects/${projectId}/sprints/${deleting.sprint.id}${options.moveTo ? `?moveTo=${options.moveTo}` : ""}`;
    try {
      const response = await fetch(url, { method: "DELETE" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return result.error ?? "Unable to delete. Please try again.";
    } catch {
      return "Could not connect. Please try again.";
    }
    setDeleting(null);
    if (deleting.kind === "project") router.replace("/");
    else router.replace(`/?project=${projectId}${options.moveTo ? `&sprint=${options.moveTo}` : ""}`);
    return null;
  }

  async function deleteTask(task: Task) {
    if (!board.project || !window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    const error = await mutate(`/api/projects/${board.project.id}/tasks/${task.id}`, "DELETE");
    if (error) setActionError(error);
  }

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <Sidebar projects={board.projects} selectedProjectId={board.project?.id} userName={user.name || user.email} userEmail={user.email} open={menuOpen} onClose={closeMenu} onAddProject={() => setDialog({ type: "project" })} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar projectName={board.project?.name} onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pb-10 lg:px-10 lg:pt-8">
          {board.project ? <>
            <ProjectOverview project={board.project} team={board.team} onOpenTeam={() => setTeamOpen(true)} onEdit={() => setDialog({ type: "project", editProject: true })} />
            <FeatureList projectId={board.project.id} features={board.features} />
            <SprintBoard
              projectId={board.project.id}
              tasks={tasks}
              backlogCount={board.backlogCount}
              sprint={board.sprint}
              sprints={board.sprints}
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              actionError={actionError}
              onDismissError={() => setActionError("")}
              onStatusChange={moveTask}
              onEditTask={(task) => setDialog({ type: "task", task })}
              onDeleteTask={deleteTask}
              onCreateTask={() => setDialog({ type: "task" })}
              onCreateSprint={() => setDialog({ type: "sprint" })}
              onEditSprint={(sprint) => setDialog({ type: "sprint", sprint })}
              onSelectSprint={(sprintId) => router.replace(`/?project=${board.project!.id}&sprint=${sprintId}`)}
              onReorderTasks={reorderTasks}
              onError={setActionError}
            />
          </> : <section className="mx-auto mt-10 max-w-md rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-sm sm:mt-16">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500"><Icon name="folder" size={22} /></span>
            <h1 className="mt-4 text-lg font-semibold">Start with a project</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted">Projects hold your sprints, and sprints hold your tasks.</p>
            <button onClick={() => setDialog({ type: "project" })} className="mx-auto mt-6 flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 hover:bg-brand-600"><Icon name="plus" size={18} />Create project</button>
          </section>}
        </main>
      </div>
      {teamOpen && board.project && board.team && <TeamDialog projectId={board.project.id} projectName={board.project.name} team={board.team} currentUserId={user.id} onClose={() => setTeamOpen(false)} />}
      {dialog && <CreateDialog key={`${dialog.type}-${dialog.task?.id ?? dialog.sprint?.id ?? (dialog.editProject ? "edit" : "new")}`} type={dialog.type} task={dialog.task} sprint={dialog.sprint}
        project={dialog.editProject && board.project ? { name: board.project.name, description: board.project.description, logo: board.project.logo } : undefined}
        sprintOptions={board.sprints} currentSprintId={board.sprint?.id} projectName={board.project?.name ?? "Workspace"}
        onDelete={dialog.sprint ? () => { setDeleting({ kind: "sprint", sprint: dialog.sprint! }); setDialog(null); }
          : dialog.editProject && board.team?.isOwner ? () => { setDeleting({ kind: "project" }); setDialog(null); } : undefined}
        onClose={() => setDialog(null)} onCreate={createOrUpdateItem} />}
      {deleting && board.project && <DeleteDialog kind={deleting.kind} name={deleting.kind === "project" ? board.project.name : deleting.sprint.name}
        taskCount={deleting.kind === "sprint" && deleting.sprint.id === board.sprint?.id ? board.tasks.length : 0}
        otherSprints={deleting.kind === "sprint" ? board.sprints.filter((item) => item.id !== deleting.sprint.id) : []}
        onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}
