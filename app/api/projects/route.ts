import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to create a project." }, { status: 401 });

  try {
    const body = await request.json() as { title?: string; description?: string };
    const title = body.title?.trim();
    const description = body.description?.trim();
    if (!title || !description) return NextResponse.json({ error: "Project title and description are required." }, { status: 400 });

    const now = new Date();
    const result = await (await getDatabase()).collection("projects").insertOne({
      name: title,
      description,
      ownerId: new ObjectId(user.id),
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
  } catch (error) {
    console.error("Project creation failed", error);
    return NextResponse.json({ error: "Unable to create the project right now." }, { status: 500 });
  }
}
