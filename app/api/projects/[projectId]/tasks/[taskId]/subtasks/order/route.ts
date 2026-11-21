import { NextResponse } from "next/server";
import { applyOrder, parseIdList } from "@/lib/reorder";
import { resolveTask } from "@/lib/task-access";

/** Saves the subtask sequence of a task: body `{ ids: [subtaskId, …] }` in display order. */
export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  try {
    const { projectId, taskId } = await params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    const body = await request.json() as { ids?: unknown };
    const ids = parseIdList(body.ids);
    if (!ids) return NextResponse.json({ error: "Invalid subtask order." }, { status: 400 });
    await applyOrder(resolved.db, "subtasks", { taskId: resolved.task._id }, ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Subtask reorder failed", error);
    return NextResponse.json({ error: "Unable to save the subtask order right now." }, { status: 500 });
  }
}
