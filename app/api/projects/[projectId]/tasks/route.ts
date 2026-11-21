import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { dateRangeIsValid, isValidDateOnly } from "@/lib/date-validation";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to create a task." }, { status: 401 });
  const { projectId } = await params;

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const body = await request.json() as { title?: string; description?: string; sprintId?: string; startDate?: string; deadline?: string };
    const title = body.title?.trim();
    const description = body.description?.trim();
    if (!title || !description) return NextResponse.json({ error: "Task title and description are required." }, { status: 400 });
    if (!isValidDateOnly(body.startDate) || !isValidDateOnly(body.deadline)) return NextResponse.json({ error: "Enter valid task dates." }, { status: 400 });
    if (!dateRangeIsValid(body.startDate, body.deadline)) return NextResponse.json({ error: "Deadline must be on or after the start date." }, { status: 400 });

    const projectRef = project._id as ObjectId;
    const sprintFilter = body.sprintId && ObjectId.isValid(body.sprintId)
      ? { _id: new ObjectId(body.sprintId), projectId: projectRef }
      : { projectId: projectRef, status: { $in: ["active", "Active", "in progress"] } };
    const sprint = await db.collection("sprints").findOne(sprintFilter, { sort: { createdAt: -1 } });
    if (!sprint) return NextResponse.json({ error: "Create an active sprint before adding tasks." }, { status: 409 });

    const count = await db.collection("tasks").countDocuments({ projectId: projectRef, sprintId: sprint._id });
    const prefix = typeof project.key === "string" && project.key.trim() ? project.key.trim().toUpperCase() : "TASK";
    const result = await db.collection("tasks").insertOne({
      projectId: projectRef,
      sprintId: sprint._id,
      key: `${prefix}-${count + 1}`,
      title,
      description,
      startDate: body.startDate || null,
      deadline: body.deadline || null,
      type: "Task",
      priority: "Medium",
      status: "To do",
      assigneeName: "Unassigned",
      createdBy: new ObjectId(user.id),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
  } catch (error) {
    console.error("Task creation failed", error);
    return NextResponse.json({ error: "Unable to create the task right now." }, { status: 500 });
  }
}
