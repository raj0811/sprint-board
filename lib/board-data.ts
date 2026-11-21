import "server-only";
import { ObjectId, type Document } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { getProjectTeam, ownerIdOf, type Team } from "@/lib/team";

export type TaskStatus = "To do" | "In progress" | "Done";
export type Task = {
  id: string;
  key: string;
  title: string;
  description: string;
  startDate: string;
  deadline: string;
  kind: "Story" | "Bug" | "Task";
  priority: "High" | "Medium" | "Low";
  assignee: string;
  initials: string;
  color: string;
  status: TaskStatus;
  subtaskTotal: number;
  subtaskDone: number;
  commentCount: number;
};
/** `shared` is true when someone else owns the project and the user is a team member. */
export type ProjectOption = { id: string; name: string; shared: boolean };
export type Sprint = { id: string; name: string; description: string; status: string; startDate: string; deadline: string };
export type BoardData = {
  project: (ProjectOption & { description: string }) | null;
  projects: ProjectOption[];
  sprints: Sprint[];
  sprint: Sprint | null;
  tasks: Task[];
  backlogCount: number;
  team: Team | null;
};

export function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function mapStatus(value: unknown): TaskStatus {
  const status = text(value).toLowerCase().replaceAll("_", " ");
  if (["done", "complete", "completed"].includes(status)) return "Done";
  if (["in progress", "inprogress", "doing"].includes(status)) return "In progress";
  return "To do";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
}

export function objectIdOrString(id: string) {
  return ObjectId.isValid(id) ? [new ObjectId(id), id] : [id];
}

export function dateText(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return text(value);
}

export async function getBoardData(userId: string, selectedProjectId?: string, selectedSprintId?: string): Promise<BoardData> {
  const db = await getDatabase();
  const userIds = objectIdOrString(userId);
  const accessibleProjects = await db.collection("projects").find({
    $or: [
      { ownerId: { $in: userIds } }, { userId: { $in: userIds } },
      { owner_id: { $in: userIds } }, { memberIds: { $in: userIds } },
    ],
  }).sort({ updatedAt: -1, createdAt: -1 }).toArray();

  const projects = accessibleProjects.map((project) => ({
    id: String(project._id),
    name: text(project.name ?? project.title, "Untitled project"),
    shared: ownerIdOf(project) !== userId,
  }));
  const selected = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : undefined;
  const project = accessibleProjects.find((item) => String(item._id) === selected?.id) ?? accessibleProjects[0];
  if (!project) return { project: null, projects: [], sprints: [], sprint: null, tasks: [], backlogCount: 0, team: null };

  const projectId = String(project._id);
  const projectRefs = objectIdOrString(projectId);
  const storedSprints = await db.collection("sprints").find({ projectId: { $in: projectRefs } }).sort({ createdAt: -1 }).toArray();
  const sprints: Sprint[] = storedSprints.map((item) => ({
    id: String(item._id),
    name: text(item.name ?? item.title, "Untitled sprint"),
    description: text(item.description),
    status: text(item.status, "planned"),
    startDate: dateText(item.startDate),
    deadline: dateText(item.deadline ?? item.endDate),
  }));
  const sprint = sprints.find((item) => item.id === selectedSprintId)
    ?? sprints.find((item) => ["active", "in progress"].includes(item.status.toLowerCase()))
    ?? sprints[0]
    ?? null;

  const storedTasks = sprint
    ? await db.collection("tasks").find({ projectId: { $in: projectRefs }, sprintId: { $in: objectIdOrString(sprint.id) } }).sort({ createdAt: -1 }).toArray()
    : [];
  const backlogCount = await db.collection("tasks").countDocuments({
    projectId: { $in: projectRefs },
    $or: [{ sprintId: null }, { sprintId: { $exists: false } }],
  });
  const [counts, team] = await Promise.all([getTaskCounts(storedTasks.map((task) => task._id)), getProjectTeam(db, project, userId)]);
  const tasks = storedTasks.map((task, index) => mapTask(task, index, counts.get(String(task._id))));

  return {
    projects,
    project: {
      id: projectId,
      name: text(project.name ?? project.title, "Untitled project"),
      shared: ownerIdOf(project) !== userId,
      description: text(project.description),
    },
    sprints,
    sprint,
    tasks,
    backlogCount,
    team,
  };
}

type TaskCounts = { subtaskTotal: number; subtaskDone: number; commentCount: number };

/** Subtask progress and comment totals for a set of tasks, keyed by task id. */
export async function getTaskCounts(taskIds: unknown[]) {
  const counts = new Map<string, TaskCounts>();
  if (!taskIds.length) return counts;
  const db = await getDatabase();
  const [subtasks, comments] = await Promise.all([
    db.collection("subtasks").aggregate<{ _id: unknown; total: number; done: number }>([
      { $match: { taskId: { $in: taskIds } } },
      { $group: { _id: "$taskId", total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] } } } },
    ]).toArray(),
    db.collection("comments").aggregate<{ _id: unknown; total: number }>([
      { $match: { taskId: { $in: taskIds } } },
      { $group: { _id: "$taskId", total: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const entry = (id: unknown) => {
    const key = String(id);
    if (!counts.has(key)) counts.set(key, { subtaskTotal: 0, subtaskDone: 0, commentCount: 0 });
    return counts.get(key)!;
  };
  for (const row of subtasks) Object.assign(entry(row._id), { subtaskTotal: row.total, subtaskDone: row.done });
  for (const row of comments) entry(row._id).commentCount = row.total;
  return counts;
}

export function mapTask(task: Document, index: number, counts?: TaskCounts): Task {
  const assignee = text(task.assigneeName ?? task.assignee, "Unassigned");
  const kind = text(task.type ?? task.kind, "Task");
  const priority = text(task.priority, "Medium");
  return {
    id: String(task._id),
    key: text(task.key ?? task.issueKey, `TASK-${index + 1}`),
    title: text(task.title ?? task.name, "Untitled task"),
    description: text(task.description),
    startDate: dateText(task.startDate),
    deadline: dateText(task.deadline ?? task.dueDate),
    kind: (["Story", "Bug", "Task"].includes(kind) ? kind : "Task") as Task["kind"],
    priority: (["High", "Medium", "Low"].includes(priority) ? priority : "Medium") as Task["priority"],
    assignee,
    initials: initials(assignee),
    color: ["lavender", "mint", "peach", "sky", "plum"][index % 5],
    status: mapStatus(task.status),
    subtaskTotal: counts?.subtaskTotal ?? 0,
    subtaskDone: counts?.subtaskDone ?? 0,
    commentCount: counts?.commentCount ?? 0,
  };
}
