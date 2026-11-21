import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { resolveTask } from "@/lib/task-access";

type RouteContext = { params: Promise<{ projectId: string; taskId: string; commentId: string }> };

/** Deletes a comment. Only its author may delete it. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, taskId, commentId } = await params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    if (!ObjectId.isValid(commentId)) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    const result = await resolved.db.collection("comments").deleteOne({
      _id: new ObjectId(commentId),
      taskId: resolved.task._id,
      authorId: new ObjectId(resolved.user.id),
    });
    if (!result.deletedCount) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Comment deletion failed", error);
    return NextResponse.json({ error: "Unable to delete the comment right now." }, { status: 500 });
  }
}
