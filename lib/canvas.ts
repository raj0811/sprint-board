import "server-only";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { text } from "@/lib/board-data";

/** Summary shown on the task page (no scene data). */
export type CanvasSummary = { id: string; title: string; previewSvg: string; updatedAt: string; updatedByName: string };

/** Everything the editor needs. `elements`/`files` are Excalidraw scene data, stored as-is. */
export type CanvasDocument = {
  id: string;
  title: string;
  elements: unknown[];
  files: Record<string, unknown>;
  viewBackgroundColor: string;
  updatedAt: string;
  task: { id: string; key: string; title: string };
  projectId: string;
};

/** Maximum JSON size of a saved scene (MongoDB documents are capped at 16 MB). */
export const MAX_SCENE_BYTES = 8 * 1024 * 1024;

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : text(value);
}

export async function listTaskCanvases(taskId: ObjectId): Promise<CanvasSummary[]> {
  const db = await getDatabase();
  const docs = await db.collection("canvases")
    .find({ taskId }, { projection: { title: 1, previewSvg: 1, updatedAt: 1, updatedByName: 1 } })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((doc) => ({
    id: String(doc._id),
    title: text(doc.title, "Untitled canvas"),
    previewSvg: text(doc.previewSvg),
    updatedAt: iso(doc.updatedAt),
    updatedByName: text(doc.updatedByName),
  }));
}

export async function getCanvasForUser(userId: string, canvasId: string): Promise<CanvasDocument | null> {
  if (!ObjectId.isValid(canvasId)) return null;
  const db = await getDatabase();
  const canvas = await db.collection("canvases").findOne({ _id: new ObjectId(canvasId) });
  if (!canvas) return null;
  const project = await findAccessibleProject(db, userId, String(canvas.projectId));
  if (!project) return null;
  const task = await db.collection("tasks").findOne({ _id: canvas.taskId, projectId: project._id }, { projection: { key: 1, title: 1 } });
  if (!task) return null;
  return {
    id: String(canvas._id),
    title: text(canvas.title, "Untitled canvas"),
    elements: Array.isArray(canvas.elements) ? canvas.elements : [],
    files: canvas.files && typeof canvas.files === "object" ? canvas.files as Record<string, unknown> : {},
    viewBackgroundColor: text(canvas.viewBackgroundColor, "#ffffff"),
    updatedAt: iso(canvas.updatedAt),
    task: { id: String(task._id), key: text(task.key, "TASK"), title: text(task.title, "Untitled task") },
    projectId: String(project._id),
  };
}
