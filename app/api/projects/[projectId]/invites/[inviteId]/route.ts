import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { isProjectOwner } from "@/lib/team";

/** Cancels a pending invite (owner only). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string; inviteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { projectId, inviteId } = await params;
  if (!ObjectId.isValid(inviteId)) return NextResponse.json({ error: "Invite not found." }, { status: 404 });

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (!isProjectOwner(project, user.id)) return NextResponse.json({ error: "Only the project owner can cancel invites." }, { status: 403 });
    await db.collection("invites").deleteOne({ _id: new ObjectId(inviteId), projectId: project._id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Invite cancellation failed", error);
    return NextResponse.json({ error: "Unable to cancel the invite right now." }, { status: 500 });
  }
}
