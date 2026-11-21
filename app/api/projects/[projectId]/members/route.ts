import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { isProjectOwner, ownerIdOf } from "@/lib/team";

/**
 * Invites someone to the project by email (owner only).
 * Existing users are added straight away; otherwise the invite waits until they sign up with that email.
 */
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to invite people." }, { status: 401 });
  const { projectId } = await params;

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (!isProjectOwner(project, user.id)) return NextResponse.json({ error: "Only the project owner can invite people." }, { status: 403 });

    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (email === user.email.toLowerCase()) return NextResponse.json({ error: "You already own this project." }, { status: 400 });

    const invitee = await db.collection("users").findOne({ email }, { projection: { _id: 1 } });
    if (invitee) {
      const inviteeId = String(invitee._id);
      const memberIds = Array.isArray(project.memberIds) ? project.memberIds.map(String) : [];
      if (inviteeId === ownerIdOf(project) || memberIds.includes(inviteeId)) return NextResponse.json({ error: "They're already on this project." }, { status: 409 });
      await db.collection("projects").updateOne({ _id: project._id }, { $addToSet: { memberIds: invitee._id }, $set: { updatedAt: new Date() } });
      return NextResponse.json({ status: "added" }, { status: 201 });
    }

    const existing = await db.collection("invites").findOne({ projectId: project._id, email }, { projection: { _id: 1 } });
    if (existing) return NextResponse.json({ error: "An invite is already waiting for this email." }, { status: 409 });
    await db.collection("invites").insertOne({ projectId: project._id, email, invitedBy: new ObjectId(user.id), createdAt: new Date() });
    return NextResponse.json({ status: "invited" }, { status: 201 });
  } catch (error) {
    console.error("Invite failed", error);
    return NextResponse.json({ error: "Unable to send the invite right now." }, { status: 500 });
  }
}
