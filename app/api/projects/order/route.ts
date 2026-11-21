import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { parseIdList } from "@/lib/reorder";

/**
 * Saves the signed-in user's own sidebar order: body `{ ids: [projectId, …] }`.
 * Stored on the user (not the project) because shared projects appear in several people's sidebars.
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  try {
    const body = await request.json() as { ids?: unknown };
    const ids = parseIdList(body.ids);
    if (!ids) return NextResponse.json({ error: "Invalid project order." }, { status: 400 });
    const db = await getDatabase();
    await db.collection("users").updateOne({ _id: new ObjectId(user.id) }, { $set: { projectOrder: ids.map(String) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Project reorder failed", error);
    return NextResponse.json({ error: "Unable to save the project order right now." }, { status: 500 });
  }
}
