import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { resolveTask } from "@/lib/task-access";

type RouteContext = { params: Promise<{ projectId: string; taskId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { projectId, taskId } = await params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    const body = await request.json() as { title?: string };
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "Subtask title is required." }, { status: 400 });
    if (title.length > 300) return NextResponse.json({ error: "Keep the subtask title under 300 characters." }, { status: 400 });
    const now = new Date();
    const result = await resolved.db.collection("subtasks").insertOne({
      projectId: resolved.project._id,
      taskId: resolved.task._id,
      title,
      status: "To do",
      createdBy: new ObjectId(resolved.user.id),
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
  } catch (error) {
    console.error("Subtask creation failed", error);
    return NextResponse.json({ error: "Unable to add the subtask right now." }, { status: 500 });
  }
}
