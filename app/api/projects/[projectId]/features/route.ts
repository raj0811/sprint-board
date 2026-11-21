import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addFeatures, MAX_FEATURE_LENGTH, MAX_FEATURES_PER_PROJECT } from "@/lib/features";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";

/** Adds a key feature to the project. Any team member can add features. */
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { projectId } = await params;

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const body = await request.json() as { title?: string };
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "Describe the feature first." }, { status: 400 });
    if (title.length > MAX_FEATURE_LENGTH) return NextResponse.json({ error: `Keep features under ${MAX_FEATURE_LENGTH} characters.` }, { status: 400 });
    if (await db.collection("features").countDocuments({ projectId: project._id }) >= MAX_FEATURES_PER_PROJECT) {
      return NextResponse.json({ error: `A project can have up to ${MAX_FEATURES_PER_PROJECT} features.` }, { status: 400 });
    }
    const [id] = await addFeatures(db, project._id, user.id, [title]);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Feature creation failed", error);
    return NextResponse.json({ error: "Unable to add the feature right now." }, { status: 500 });
  }
}
