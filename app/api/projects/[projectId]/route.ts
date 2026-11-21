import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteTasksWhere } from "@/lib/cascade";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { isProjectOwner } from "@/lib/team";

type RouteContext = { params: Promise<{ projectId: string }> };

/** Renames the project and/or changes its description. Any team member can edit. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const body = await request.json() as { title?: string; description?: string };
    const updates: Record<string, string | Date> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return NextResponse.json({ error: "Project title cannot be empty." }, { status: 400 });
      if (title.length > 200) return NextResponse.json({ error: "Keep the project title under 200 characters." }, { status: 400 });
      updates.name = title;
    }
    if (body.description !== undefined) {
      const description = String(body.description).trim();
      if (!description) return NextResponse.json({ error: "Project description cannot be empty." }, { status: 400 });
      updates.description = description;
    }
    await db.collection("projects").updateOne({ _id: project._id }, { $set: updates });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Project update failed", error);
    return NextResponse.json({ error: "Unable to update the project right now." }, { status: 500 });
  }
}

/** Permanently deletes the project and all of its data. Owner only. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (!isProjectOwner(project, user.id)) return NextResponse.json({ error: "Only the project owner can delete it." }, { status: 403 });

    const scope = { projectId: project._id };
    await deleteTasksWhere(db, scope);
    await Promise.all([
      db.collection("sprints").deleteMany(scope),
      db.collection("features").deleteMany(scope),
      db.collection("invites").deleteMany(scope),
      // Catch any leftovers not reached through a task.
      db.collection("subtasks").deleteMany(scope),
      db.collection("comments").deleteMany(scope),
      db.collection("canvases").deleteMany(scope),
    ]);
    await db.collection("projects").deleteOne({ _id: project._id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Project deletion failed", error);
    return NextResponse.json({ error: "Unable to delete the project right now." }, { status: 500 });
  }
}
