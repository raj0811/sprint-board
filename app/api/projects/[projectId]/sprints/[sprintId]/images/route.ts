import { NextResponse } from "next/server";
import { appendImages } from "@/lib/image-routes";
import { resolveSprint } from "@/lib/sprint-access";

type RouteContext = { params: Promise<{ projectId: string; sprintId: string }> };

/** Attaches images to the sprint. Multipart form with one or more `image` files. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { projectId, sprintId } = await params;
    const resolved = await resolveSprint(projectId, sprintId);
    if ("response" in resolved) return resolved.response;
    return await appendImages(request, resolved.db, "sprints", resolved.sprint, resolved.user.id);
  } catch (error) {
    console.error("Sprint image upload failed", error);
    return NextResponse.json({ error: "Unable to attach images right now." }, { status: 500 });
  }
}
