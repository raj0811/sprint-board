import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { resolveTask } from "@/lib/task-access";

type RouteContext = { params: Promise<{ projectId: string; taskId: string }> };

/** Adds a comment to the task, or to one of its subtasks when `subtaskId` is given. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { projectId, taskId } = await params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    const body = await request.json() as { body?: string; subtaskId?: string };
    const text = body.body?.trim();
    if (!text) return NextResponse.json({ error: "Write something before posting." }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: "Keep comments under 5,000 characters." }, { status: 400 });

    let subtaskId: ObjectId | null = null;
    if (body.subtaskId) {
      if (!ObjectId.isValid(body.subtaskId)) return NextResponse.json({ error: "Subtask not found." }, { status: 404 });
      const subtask = await resolved.db.collection("subtasks").findOne({ _id: new ObjectId(body.subtaskId), taskId: resolved.task._id }, { projection: { _id: 1 } });
      if (!subtask) return NextResponse.json({ error: "Subtask not found." }, { status: 404 });
      subtaskId = subtask._id;
    }

    const result = await resolved.db.collection("comments").insertOne({
      projectId: resolved.project._id,
      taskId: resolved.task._id,
      subtaskId,
      body: text,
      authorId: new ObjectId(resolved.user.id),
      authorName: resolved.user.name || resolved.user.email,
      createdAt: new Date(),
    });
    return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
  } catch (error) {
    console.error("Comment creation failed", error);
    return NextResponse.json({ error: "Unable to post the comment right now." }, { status: 500 });
  }
}
