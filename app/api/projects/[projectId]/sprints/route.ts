import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { findAccessibleProject } from "@/lib/project-access";
import { dateRangeIsValid, isValidDateOnly } from "@/lib/date-validation";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to create a sprint." }, { status: 401 });
  const { projectId } = await params;
  if (!ObjectId.isValid(projectId)) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  try {
    const db = await getDatabase();
    const project = await findAccessibleProject(db, user.id, projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const body = await request.json() as { title?: string; description?: string; startDate?: string; deadline?: string };
    const title = body.title?.trim();
    const description = body.description?.trim();
    if (!title || !description) return NextResponse.json({ error: "Sprint title and description are required." }, { status: 400 });
    if (!isValidDateOnly(body.startDate) || !isValidDateOnly(body.deadline)) return NextResponse.json({ error: "Enter valid sprint dates." }, { status: 400 });
    if (!dateRangeIsValid(body.startDate, body.deadline)) return NextResponse.json({ error: "Deadline must be on or after the start date." }, { status: 400 });
    const now = new Date();
    const activeSprint = await db.collection("sprints").findOne({
      projectId: project._id,
      status: { $in: ["active", "Active", "in progress"] },
    }, { projection: { _id: 1 } });
    const result = await db.collection("sprints").insertOne({
      projectId: project._id,
      name: title,
      description,
      status: activeSprint ? "planned" : "active",
      startDate: body.startDate || null,
      deadline: body.deadline || null,
      endDate: body.deadline || null,
      createdBy: new ObjectId(user.id),
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
  } catch (error) {
    console.error("Sprint creation failed", error);
    return NextResponse.json({ error: "Unable to create the sprint right now." }, { status: 500 });
  }
}
