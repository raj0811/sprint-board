import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { dateRangeIsValid, isValidDateOnly } from "@/lib/date-validation";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";

type RouteContext = { params: Promise<{ projectId: string; sprintId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to edit this sprint." }, { status: 401 });
  const { projectId, sprintId } = await params;
  if (!ObjectId.isValid(sprintId)) return NextResponse.json({ error: "Sprint not found." }, { status: 404 });

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const sprint = await db.collection("sprints").findOne({ _id: new ObjectId(sprintId), projectId: project._id });
    if (!sprint) return NextResponse.json({ error: "Sprint not found." }, { status: 404 });

    const body = await request.json() as { title?: string; description?: string; startDate?: string; deadline?: string };
    const updates: Record<string, string | Date | null> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: "Sprint title cannot be empty." }, { status: 400 });
      updates.name = title;
    }
    if (body.description !== undefined) {
      const description = body.description.trim();
      if (!description) return NextResponse.json({ error: "Sprint description cannot be empty." }, { status: 400 });
      updates.description = description;
    }
    if (body.startDate !== undefined && !isValidDateOnly(body.startDate)) return NextResponse.json({ error: "Enter a valid start date." }, { status: 400 });
    if (body.deadline !== undefined && !isValidDateOnly(body.deadline)) return NextResponse.json({ error: "Enter a valid deadline." }, { status: 400 });
    const nextStart = body.startDate !== undefined ? body.startDate : typeof sprint.startDate === "string" ? sprint.startDate : "";
    const nextDeadline = body.deadline !== undefined ? body.deadline : typeof sprint.deadline === "string" ? sprint.deadline : typeof sprint.endDate === "string" ? sprint.endDate : "";
    if (!dateRangeIsValid(nextStart, nextDeadline)) return NextResponse.json({ error: "Deadline must be on or after the start date." }, { status: 400 });
    if (body.startDate !== undefined) updates.startDate = body.startDate || null;
    if (body.deadline !== undefined) {
      updates.deadline = body.deadline || null;
      updates.endDate = body.deadline || null;
    }
    await db.collection("sprints").updateOne({ _id: sprint._id }, { $set: updates });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sprint update failed", error);
    return NextResponse.json({ error: "Unable to update the sprint right now." }, { status: 500 });
  }
}
