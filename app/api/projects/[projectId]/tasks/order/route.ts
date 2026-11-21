import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { applyOrder, parseIdList } from "@/lib/reorder";

const STATUSES = ["To do", "In progress", "Done"] as const;

/**
 * Saves the board layout of one sprint after a drag:
 * body `{ sprintId, columns: { "To do": [taskId…], "In progress": […], "Done": […] } }`.
 * Each task gets its column's status and its position within the column.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const body = await request.json() as { sprintId?: unknown; columns?: Record<string, unknown> };
    if (typeof body.sprintId !== "string" || !ObjectId.isValid(body.sprintId) || !body.columns || typeof body.columns !== "object") {
      return NextResponse.json({ error: "Invalid task order." }, { status: 400 });
    }
    const sprintId = new ObjectId(body.sprintId);
    const columns = STATUSES.map((status) => [status, parseIdList(body.columns![status] ?? [])] as const);
    if (columns.some(([, ids]) => !ids)) return NextResponse.json({ error: "Invalid task order." }, { status: 400 });
    const all = columns.flatMap(([, ids]) => ids!.map(String));
    if (new Set(all).size !== all.length) return NextResponse.json({ error: "Invalid task order." }, { status: 400 });

    await Promise.all(columns.map(([status, ids]) =>
      applyOrder(db, "tasks", { projectId: project._id, sprintId }, ids!, () => ({ status }))));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Task reorder failed", error);
    return NextResponse.json({ error: "Unable to save the task order right now." }, { status: 500 });
  }
}
