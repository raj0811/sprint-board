import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { acceptPendingInvites } from "@/lib/team";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json() as { name?: string; email?: string; password?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    if (!name?.trim() || !normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || !password || password.length < 8) {
      return NextResponse.json({ error: "Enter your name, a valid email, and a password with at least 8 characters." }, { status: 400 });
    }
    const db = await getDatabase();
    const users = db.collection("users");
    if (await users.findOne({ email: normalizedEmail }, { projection: { _id: 1 } })) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    const result = await users.insertOne({
      name: name.trim(), email: normalizedEmail, passwordHash: await hashPassword(password), createdAt: new Date(),
    });
    await acceptPendingInvites(String(result.insertedId), normalizedEmail);
    await createSession(String(result.insertedId));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Registration failed", error);
    return NextResponse.json({ error: "Unable to create your account right now." }, { status: 500 });
  }
}
