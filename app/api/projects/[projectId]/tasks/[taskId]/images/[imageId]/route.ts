import { NextResponse } from "next/server";
import { removeImage } from "@/lib/image-routes";
import { resolveTask } from "@/lib/task-access";

type RouteContext = { params: Promise<{ projectId: string; taskId: string; imageId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, taskId, imageId } = await params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    return await removeImage(resolved.db, "tasks", resolved.task, imageId);
  } catch (error) {
    console.error("Task image removal failed", error);
    return NextResponse.json({ error: "Unable to remove the image right now." }, { status: 500 });
  }
}
