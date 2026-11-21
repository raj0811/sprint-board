import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { resolveTask, SUBTASK_STATUSES } from "@/lib/task-access";

type RouteContext = { params: Promise<{ projectId: string; taskId: string; subtaskId: string }> };

async function resolveSubtask(context: RouteContext) {
  const { projectId, taskId, subtaskId } = await context.params;
  const resolved = await resolveTask(projectId, taskId);
  if ("response" in resolved) return { response: resolved.response };
  if (!ObjectId.isValid(subtaskId)) return { response: NextResponse.json({ error: "Subtask not found." }, { status: 404 }) };
  const subtask = await resolved.db.collection("subtasks").findOne({ _id: new ObjectId(subtaskId), taskId: resolved.task._id });
  if (!subtask) return { response: NextResponse.json({ error: "Subtask not found." }, { status: 404 }) };
  return { ...resolved, subtask };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveSubtask(context);
    if ("response" in resolved) return resolved.response;
    const body = await request.json() as { title?: string; status?: string };
    const updates: Record<string, string | Date> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: "Subtask title cannot be empty." }, { status: 400 });
      if (title.length > 300) return NextResponse.json({ error: "Keep the subtask title under 300 characters." }, { status: 400 });
      updates.title = title;
    }
    if (body.status !== undefined) {
      if (!SUBTASK_STATUSES.includes(body.status)) return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
      updates.status = body.status;
    }
    await resolved.db.collection("subtasks").updateOne({ _id: resolved.subtask._id }, { $set: updates });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Subtask update failed", error);
    return NextResponse.json({ error: "Unable to update the subtask right now." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const resolved = await resolveSubtask(context);
    if ("response" in resolved) return resolved.response;
    await Promise.all([
      resolved.db.collection("subtasks").deleteOne({ _id: resolved.subtask._id }),
      resolved.db.collection("comments").deleteMany({ subtaskId: resolved.subtask._id }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Subtask deletion failed", error);
    return NextResponse.json({ error: "Unable to delete the subtask right now." }, { status: 500 });
  }
}
