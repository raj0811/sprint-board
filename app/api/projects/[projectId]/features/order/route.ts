import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { applyOrder, parseIdList } from "@/lib/reorder";

/** Saves the key-feature sequence: body `{ ids: [featureId, …] }` in display order. */
export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const body = await request.json() as { ids?: unknown };
    const ids = parseIdList(body.ids);
    if (!ids) return NextResponse.json({ error: "Invalid feature order." }, { status: 400 });
    await applyOrder(db, "features", { projectId: project._id }, ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feature reorder failed", error);
    return NextResponse.json({ error: "Unable to save the feature order right now." }, { status: 500 });
  }
}
