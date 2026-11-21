import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { isProjectOwner, ownerIdOf } from "@/lib/team";

/** The owner removes a member, or a member leaves the project (memberId = their own id). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string; memberId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { projectId, memberId } = await params;
  if (!ObjectId.isValid(memberId)) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (memberId === ownerIdOf(project)) return NextResponse.json({ error: "The owner can't be removed from their project." }, { status: 400 });
    if (memberId !== user.id && !isProjectOwner(project, user.id)) return NextResponse.json({ error: "Only the project owner can remove people." }, { status: 403 });

    await db.collection<{ memberIds?: (ObjectId | string)[]; updatedAt?: Date }>("projects").updateOne({ _id: project._id }, { $pullAll: { memberIds: [new ObjectId(memberId), memberId] }, $set: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Member removal failed", error);
    return NextResponse.json({ error: "Unable to update the team right now." }, { status: 500 });
  }
}
