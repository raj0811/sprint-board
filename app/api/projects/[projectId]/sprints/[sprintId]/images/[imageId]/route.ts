import { NextResponse } from "next/server";
import { removeImage } from "@/lib/image-routes";
import { resolveSprint } from "@/lib/sprint-access";

type RouteContext = { params: Promise<{ projectId: string; sprintId: string; imageId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, sprintId, imageId } = await params;
    const resolved = await resolveSprint(projectId, sprintId);
    if ("response" in resolved) return resolved.response;
    return await removeImage(resolved.db, "sprints", resolved.sprint, imageId);
  } catch (error) {
    console.error("Sprint image removal failed", error);
    return NextResponse.json({ error: "Unable to remove the image right now." }, { status: 500 });
  }
}
