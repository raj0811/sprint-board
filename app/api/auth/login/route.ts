import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { acceptPendingInvites } from "@/lib/team";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };
    if (!email?.trim() || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    const db = await getDatabase();
    const user = await db.collection("users").findOne({ email: email.trim().toLowerCase() });
    if (!user || typeof user.passwordHash !== "string" || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    await acceptPendingInvites(String(user._id), String(user.email));
    await createSession(String(user._id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
