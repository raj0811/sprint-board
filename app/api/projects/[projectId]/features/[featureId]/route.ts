import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { MAX_FEATURE_LENGTH } from "@/lib/features";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";

type RouteContext = { params: Promise<{ projectId: string; featureId: string }> };

async function resolveFeature(context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  const { projectId, featureId } = await context.params;
  if (!ObjectId.isValid(featureId)) return { response: NextResponse.json({ error: "Feature not found." }, { status: 404 }) };
  const db = await getDatabase();
  const project = await findAccessibleProject(db, user.id, projectId);
  if (!project) return { response: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  const feature = await db.collection("features").findOne({ _id: new ObjectId(featureId), projectId: project._id }, { projection: { _id: 1 } });
  if (!feature) return { response: NextResponse.json({ error: "Feature not found." }, { status: 404 }) };
  return { db, feature };
}

/** Renames a feature and/or marks it done / not done. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveFeature(context);
    if ("response" in resolved) return resolved.response;
    const body = await request.json() as { title?: string; done?: boolean };
    const updates: Record<string, string | boolean | Date | null> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return NextResponse.json({ error: "Feature cannot be empty." }, { status: 400 });
      if (title.length > MAX_FEATURE_LENGTH) return NextResponse.json({ error: `Keep features under ${MAX_FEATURE_LENGTH} characters.` }, { status: 400 });
      updates.title = title;
    }
    if (body.done !== undefined) {
      if (typeof body.done !== "boolean") return NextResponse.json({ error: "Invalid completion value." }, { status: 400 });
      updates.done = body.done;
      updates.completedAt = body.done ? new Date() : null;
    }
    await resolved.db.collection("features").updateOne({ _id: resolved.feature._id }, { $set: updates });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feature update failed", error);
    return NextResponse.json({ error: "Unable to update the feature right now." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const resolved = await resolveFeature(context);
    if ("response" in resolved) return resolved.response;
    await resolved.db.collection("features").deleteOne({ _id: resolved.feature._id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feature deletion failed", error);
    return NextResponse.json({ error: "Unable to delete the feature right now." }, { status: 500 });
  }
}
