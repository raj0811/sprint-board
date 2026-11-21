import "server-only";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";

/** Resolves the signed-in user and a sprint they can access, or an error response. */
export async function resolveSprint(projectId: string, sprintId: string) {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (!ObjectId.isValid(sprintId)) return { response: NextResponse.json({ error: "Sprint not found." }, { status: 404 }) };
  const db = await getDatabase();
  const project = await findAccessibleProject(db, user.id, projectId);
  if (!project) return { response: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  const sprint = await db.collection("sprints").findOne({ _id: new ObjectId(sprintId), projectId: project._id });
  if (!sprint) return { response: NextResponse.json({ error: "Sprint not found." }, { status: 404 }) };
  return { db, user, project, sprint };
}
