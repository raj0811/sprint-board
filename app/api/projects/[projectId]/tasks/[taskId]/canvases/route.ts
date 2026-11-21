import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { resolveTask } from "@/lib/task-access";

type RouteContext = { params: Promise<{ projectId: string; taskId: string }> };

/** Creates an empty canvas attached to the task. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { projectId, taskId } = await params;
    const resolved = await resolveTask(projectId, taskId);
    if ("response" in resolved) return resolved.response;
    const body = await request.json().catch(() => ({})) as { title?: string };
    const title = body.title?.trim().slice(0, 200) || "Untitled canvas";
    const now = new Date();
    const result = await resolved.db.collection("canvases").insertOne({
      projectId: resolved.project._id,
      taskId: resolved.task._id,
      title,
      elements: [],
      files: {},
      viewBackgroundColor: "#ffffff",
      previewSvg: "",
      createdBy: new ObjectId(resolved.user.id),
      updatedByName: resolved.user.name || resolved.user.email,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
  } catch (error) {
    console.error("Canvas creation failed", error);
    return NextResponse.json({ error: "Unable to create the canvas right now." }, { status: 500 });
  }
}
