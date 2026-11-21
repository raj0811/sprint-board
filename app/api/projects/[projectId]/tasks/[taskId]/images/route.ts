import { NextResponse } from "next/server";
import { appendImages } from "@/lib/image-routes";
import { resolveTask } from "@/lib/task-access";

type RouteContext = { params: Promise<{ projectId: string; taskId: string }> };

/** Attaches images to the task. Multipart form with one or more `image` files. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { projectId, taskId } = await params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    return await appendImages(request, resolved.db, "tasks", resolved.task, resolved.user.id);
  } catch (error) {
    console.error("Task image upload failed", error);
    return NextResponse.json({ error: "Unable to attach images right now." }, { status: 500 });
  }
}
