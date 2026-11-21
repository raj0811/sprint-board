import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in — Orbit" };

export default function LoginPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">Loading…</main>}><LoginGate /></Suspense>;
}

async function LoginGate() {
  if (await getCurrentUser()) redirect("/");
  return <AuthForm />;
}
