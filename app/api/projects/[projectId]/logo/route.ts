import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readImageFiles, uploadToImgbb, uploadFailedResponse } from "@/lib/imgbb";
import { toAttachment } from "@/lib/images";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";

type RouteContext = { params: Promise<{ projectId: string }> };

async function resolveProject(context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  const { projectId } = await context.params;
  const db = await getDatabase();
  const project = await findAccessibleProject(db, user.id, projectId);
  if (!project) return { response: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  return { user, db, project };
}

/** Sets (or replaces) the project logo. Multipart form with one `image` file. Any team member can change it. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveProject(context);
    if ("response" in resolved) return resolved.response;
    const read = await readImageFiles(request, 1);
    if ("response" in read) return read.response;
    let logo;
    try {
      logo = await uploadToImgbb(read.files[0], resolved.user.id);
    } catch (error) {
      return uploadFailedResponse(error);
    }
    await resolved.db.collection("projects").updateOne({ _id: resolved.project._id }, { $set: { logo, updatedAt: new Date() } });
    return NextResponse.json({ logo: toAttachment(logo) }, { status: 201 });
  } catch (error) {
    console.error("Project logo update failed", error);
    return NextResponse.json({ error: "Unable to update the logo right now." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const resolved = await resolveProject(context);
    if ("response" in resolved) return resolved.response;
    await resolved.db.collection("projects").updateOne({ _id: resolved.project._id }, { $unset: { logo: "" }, $set: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Project logo removal failed", error);
    return NextResponse.json({ error: "Unable to remove the logo right now." }, { status: 500 });
  }
}
