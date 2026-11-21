import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { deleteTasksWhere } from "@/lib/cascade";
import { dateRangeIsValid, isValidDateOnly } from "@/lib/date-validation";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";

type RouteContext = { params: Promise<{ projectId: string; sprintId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to edit this sprint." }, { status: 401 });
  const { projectId, sprintId } = await params;
  if (!ObjectId.isValid(sprintId)) return NextResponse.json({ error: "Sprint not found." }, { status: 404 });

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const sprint = await db.collection("sprints").findOne({ _id: new ObjectId(sprintId), projectId: project._id });
    if (!sprint) return NextResponse.json({ error: "Sprint not found." }, { status: 404 });

    const body = await request.json() as { title?: string; description?: string; startDate?: string; deadline?: string };
    const updates: Record<string, string | Date | null> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: "Sprint title cannot be empty." }, { status: 400 });
      updates.name = title;
    }
    if (body.description !== undefined) {
      const description = body.description.trim();
      if (!description) return NextResponse.json({ error: "Sprint description cannot be empty." }, { status: 400 });
      updates.description = description;
    }
    if (body.startDate !== undefined && !isValidDateOnly(body.startDate)) return NextResponse.json({ error: "Enter a valid start date." }, { status: 400 });
    if (body.deadline !== undefined && !isValidDateOnly(body.deadline)) return NextResponse.json({ error: "Enter a valid deadline." }, { status: 400 });
    const nextStart = body.startDate !== undefined ? body.startDate : typeof sprint.startDate === "string" ? sprint.startDate : "";
    const nextDeadline = body.deadline !== undefined ? body.deadline : typeof sprint.deadline === "string" ? sprint.deadline : typeof sprint.endDate === "string" ? sprint.endDate : "";
    if (!dateRangeIsValid(nextStart, nextDeadline)) return NextResponse.json({ error: "Deadline must be on or after the start date." }, { status: 400 });
    if (body.startDate !== undefined) updates.startDate = body.startDate || null;
    if (body.deadline !== undefined) {
      updates.deadline = body.deadline || null;
      updates.endDate = body.deadline || null;
    }
    await db.collection("sprints").updateOne({ _id: sprint._id }, { $set: updates });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sprint update failed", error);
    return NextResponse.json({ error: "Unable to update the sprint right now." }, { status: 500 });
  }
}

/**
 * Deletes a sprint. Its tasks are moved to another sprint of the project when `?moveTo=<sprintId>` is given,
 * otherwise they are deleted along with their subtasks, comments and canvases.
 * If the deleted sprint was active, the next sprint in the project's order becomes active.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { projectId, sprintId } = await params;
  if (!ObjectId.isValid(sprintId)) return NextResponse.json({ error: "Sprint not found." }, { status: 404 });

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const sprint = await db.collection("sprints").findOne({ _id: new ObjectId(sprintId), projectId: project._id });
    if (!sprint) return NextResponse.json({ error: "Sprint not found." }, { status: 404 });

    const moveTo = new URL(request.url).searchParams.get("moveTo");
    if (moveTo) {
      const target = ObjectId.isValid(moveTo) && moveTo !== sprintId
        ? await db.collection("sprints").findOne({ _id: new ObjectId(moveTo), projectId: project._id }, { projection: { _id: 1 } })
        : null;
      if (!target) return NextResponse.json({ error: "Choose another sprint from this project to move the tasks to." }, { status: 400 });
      // Moved tasks go after the target sprint's existing tasks, keeping their relative order.
      const last = await db.collection("tasks").find({ sprintId: target._id, order: { $type: "number" } }).sort({ order: -1 }).limit(1).next();
      const start = typeof last?.order === "number" ? last.order + 1 : 0;
      const moving = await db.collection("tasks").find({ projectId: project._id, sprintId: sprint._id }).sort({ order: 1, createdAt: -1 }).project({ _id: 1 }).toArray();
      if (moving.length) {
        await db.collection("tasks").bulkWrite(moving.map((task, index) => ({
          updateOne: { filter: { _id: task._id }, update: { $set: { sprintId: target._id, order: start + index, updatedAt: new Date() } } },
        })));
      }
    } else {
      await deleteTasksWhere(db, { projectId: project._id, sprintId: sprint._id });
    }

    await db.collection("sprints").deleteOne({ _id: sprint._id });

    const wasActive = ["active", "in progress"].includes(String(sprint.status ?? "").toLowerCase());
    if (wasActive) {
      const next = await db.collection("sprints").find({ projectId: project._id }).sort({ order: 1, createdAt: -1 }).limit(1).next();
      if (next) await db.collection("sprints").updateOne({ _id: next._id }, { $set: { status: "active", updatedAt: new Date() } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sprint deletion failed", error);
    return NextResponse.json({ error: "Unable to delete the sprint right now." }, { status: 500 });
  }
}
