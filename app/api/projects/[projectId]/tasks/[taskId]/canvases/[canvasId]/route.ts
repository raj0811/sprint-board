import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { MAX_SCENE_BYTES } from "@/lib/canvas";
import { resolveTask } from "@/lib/task-access";

type RouteContext = { params: Promise<{ projectId: string; taskId: string; canvasId: string }> };

async function resolveCanvas(context: RouteContext) {
  const { projectId, taskId, canvasId } = await context.params;
  const resolved = await resolveTask(projectId, taskId);
  if ("response" in resolved) return { response: resolved.response };
  if (!ObjectId.isValid(canvasId)) return { response: NextResponse.json({ error: "Canvas not found." }, { status: 404 }) };
  const canvas = await resolved.db.collection("canvases").findOne({ _id: new ObjectId(canvasId), taskId: resolved.task._id }, { projection: { _id: 1 } });
  if (!canvas) return { response: NextResponse.json({ error: "Canvas not found." }, { status: 404 }) };
  return { ...resolved, canvas };
}

/** Renames the canvas and/or saves its scene (elements, files, background) and preview. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_SCENE_BYTES) return NextResponse.json({ error: "This canvas is too large to save. Try removing large images." }, { status: 413 });
    const resolved = await resolveCanvas(context);
    if ("response" in resolved) return resolved.response;

    const body = JSON.parse(raw) as { title?: unknown; elements?: unknown; files?: unknown; viewBackgroundColor?: unknown; previewSvg?: unknown };
    const updates: Record<string, unknown> = { updatedAt: new Date(), updatedByName: resolved.user.name || resolved.user.email };
    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
      if (!title) return NextResponse.json({ error: "Canvas title cannot be empty." }, { status: 400 });
      updates.title = title;
    }
    if (body.elements !== undefined) {
      if (!Array.isArray(body.elements)) return NextResponse.json({ error: "Invalid canvas data." }, { status: 400 });
      updates.elements = body.elements;
    }
    if (body.files !== undefined) {
      if (!body.files || typeof body.files !== "object" || Array.isArray(body.files)) return NextResponse.json({ error: "Invalid canvas files." }, { status: 400 });
      updates.files = body.files;
    }
    if (typeof body.viewBackgroundColor === "string") updates.viewBackgroundColor = body.viewBackgroundColor.slice(0, 40);
    // The preview is only ever rendered through <img src="data:image/svg+xml,…">, where scripts don't run.
    if (typeof body.previewSvg === "string") updates.previewSvg = body.previewSvg.length <= 400_000 ? body.previewSvg : "";

    await resolved.db.collection("canvases").updateOne({ _id: resolved.canvas._id }, { $set: updates });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Canvas save failed", error);
    return NextResponse.json({ error: "Unable to save the canvas right now." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const resolved = await resolveCanvas(context);
    if ("response" in resolved) return resolved.response;
    await resolved.db.collection("canvases").deleteOne({ _id: resolved.canvas._id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Canvas deletion failed", error);
    return NextResponse.json({ error: "Unable to delete the canvas right now." }, { status: 500 });
  }
}
