import "server-only";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";

export const SUBTASK_STATUSES = ["To do", "In progress", "Done"];

/** Resolves the signed-in user and a task they can access, or an error response. */
export async function resolveTask(projectId: string, taskId: string) {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (!ObjectId.isValid(taskId)) return { response: NextResponse.json({ error: "Task not found." }, { status: 404 }) };
  const db = await getDatabase();
  const project = await findAccessibleProject(db, user.id, projectId);
  if (!project) return { response: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  const task = await db.collection("tasks").findOne({ _id: new ObjectId(taskId), projectId: project._id });
  if (!task) return { response: NextResponse.json({ error: "Task not found." }, { status: 404 }) };
  return { db, user, project, task };
}
