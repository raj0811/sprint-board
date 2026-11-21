import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { resolveTask } from "@/lib/task-access";
import { dateRangeIsValid, isValidDateOnly } from "@/lib/date-validation";

type RouteContext = { params: Promise<{ projectId: string; taskId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, taskId } = await context.params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    const body = await request.json() as { title?: string; description?: string; status?: string; startDate?: string; deadline?: string; sprintId?: string };
    const updates: Record<string, string | Date | ObjectId | null> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: "Task title cannot be empty." }, { status: 400 });
      updates.title = title;
    }
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.startDate !== undefined && !isValidDateOnly(body.startDate)) return NextResponse.json({ error: "Enter a valid start date." }, { status: 400 });
    if (body.deadline !== undefined && !isValidDateOnly(body.deadline)) return NextResponse.json({ error: "Enter a valid deadline." }, { status: 400 });
    const storedStart = resolved.task.startDate instanceof Date ? resolved.task.startDate.toISOString().slice(0, 10) : typeof resolved.task.startDate === "string" ? resolved.task.startDate : "";
    const storedDeadline = resolved.task.deadline instanceof Date ? resolved.task.deadline.toISOString().slice(0, 10) : typeof resolved.task.deadline === "string" ? resolved.task.deadline : typeof resolved.task.dueDate === "string" ? resolved.task.dueDate : "";
    const nextStart = body.startDate !== undefined ? body.startDate : storedStart;
    const nextDeadline = body.deadline !== undefined ? body.deadline : storedDeadline;
    if (!dateRangeIsValid(nextStart, nextDeadline)) return NextResponse.json({ error: "Deadline must be on or after the start date." }, { status: 400 });
    if (body.startDate !== undefined) updates.startDate = body.startDate || null;
    if (body.deadline !== undefined) updates.deadline = body.deadline || null;
    if (body.status !== undefined) {
      if (!["To do", "In progress", "Done"].includes(body.status)) return NextResponse.json({ error: "Choose a valid task status." }, { status: 400 });
      updates.status = body.status;
    }
    if (body.sprintId !== undefined) {
      // Move the task to another sprint of the same project.
      const target = ObjectId.isValid(body.sprintId)
        ? await resolved.db.collection("sprints").findOne({ _id: new ObjectId(body.sprintId), projectId: resolved.project._id }, { projection: { _id: 1 } })
        : null;
      if (!target) return NextResponse.json({ error: "Choose a sprint from this project." }, { status: 400 });
      updates.sprintId = target._id;
    }
    await resolved.db.collection("tasks").updateOne({ _id: resolved.task._id }, { $set: updates });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Task update failed", error);
    return NextResponse.json({ error: "Unable to update the task right now." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { projectId, taskId } = await context.params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    await Promise.all([
      resolved.db.collection("tasks").deleteOne({ _id: resolved.task._id }),
      resolved.db.collection("subtasks").deleteMany({ taskId: resolved.task._id }),
      resolved.db.collection("comments").deleteMany({ taskId: resolved.task._id }),
      resolved.db.collection("canvases").deleteMany({ taskId: resolved.task._id }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Task deletion failed", error);
    return NextResponse.json({ error: "Unable to delete the task right now." }, { status: 500 });
  }
}
