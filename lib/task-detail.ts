import "server-only";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { listTaskCanvases, type CanvasSummary } from "@/lib/canvas";
import { getTaskCounts, mapStatus, mapTask, objectIdOrString, text, type Task, type TaskStatus } from "@/lib/board-data";

export type Subtask = { id: string; title: string; status: TaskStatus; createdAt: string };
export type Comment = { id: string; body: string; authorId: string; authorName: string; createdAt: string; subtaskId: string | null };
export type TaskDetail = {
  project: { id: string; name: string };
  sprint: { id: string; name: string } | null;
  /** All sprints in the project, newest first, for moving the task. */
  sprints: { id: string; name: string; status: string }[];
  task: Task & { createdAt: string };
  subtasks: Subtask[];
  comments: Comment[];
  canvases: CanvasSummary[];
};

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : text(value);
}

export async function getTaskDetail(userId: string, taskId: string): Promise<TaskDetail | null> {
  if (!ObjectId.isValid(taskId)) return null;
  const db = await getDatabase();
  const stored = await db.collection("tasks").findOne({ _id: new ObjectId(taskId) });
  if (!stored) return null;
  const project = await findAccessibleProject(db, userId, String(stored.projectId));
  if (!project) return null;

  const [sprintDocs, subtaskDocs, commentDocs, counts, canvases] = await Promise.all([
    db.collection("sprints").find({ projectId: { $in: objectIdOrString(String(project._id)) } }, { projection: { name: 1, title: 1, status: 1 } }).sort({ order: 1, createdAt: -1 }).toArray(),
    db.collection("subtasks").find({ taskId: stored._id }).sort({ order: 1, createdAt: 1 }).toArray(),
    db.collection("comments").find({ taskId: stored._id }).sort({ createdAt: 1 }).toArray(),
    getTaskCounts([stored._id]),
    listTaskCanvases(stored._id),
  ]);

  const sprints = sprintDocs.map((doc) => ({ id: String(doc._id), name: text(doc.name ?? doc.title, "Untitled sprint"), status: text(doc.status, "planned") }));
  const sprint = sprints.find((item) => item.id === String(stored.sprintId ?? "")) ?? null;

  return {
    project: { id: String(project._id), name: text(project.name ?? project.title, "Untitled project") },
    sprint: sprint ? { id: sprint.id, name: sprint.name } : null,
    sprints,
    canvases,
    task: { ...mapTask(stored, 0, counts.get(String(stored._id))), createdAt: iso(stored.createdAt) },
    subtasks: subtaskDocs.map((doc) => ({ id: String(doc._id), title: text(doc.title, "Untitled subtask"), status: mapStatus(doc.status), createdAt: iso(doc.createdAt) })),
    comments: commentDocs.map((doc) => ({
      id: String(doc._id),
      body: text(doc.body),
      authorId: String(doc.authorId ?? ""),
      authorName: text(doc.authorName, "Someone"),
      createdAt: iso(doc.createdAt),
      subtaskId: doc.subtaskId ? String(doc.subtaskId) : null,
    })),
  };
}
