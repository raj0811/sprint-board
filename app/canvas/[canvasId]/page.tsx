import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { requireUser } from "@/lib/auth";
import { getCanvasForUser } from "@/lib/canvas";

export const metadata: Metadata = { title: "Canvas — Orbit" };

export default function CanvasPage({ params }: { params: Promise<{ canvasId: string }> }) {
  return <Suspense fallback={<main className="grid h-dvh place-items-center bg-canvas text-sm text-muted">Loading canvas…</main>}>
    {params.then(({ canvasId }) => <CanvasLoader canvasId={canvasId} />)}
  </Suspense>;
}

async function CanvasLoader({ canvasId }: { canvasId: string }) {
  const user = await requireUser();
  const canvas = await getCanvasForUser(user.id, canvasId);
  if (!canvas) notFound();
  return <CanvasEditor canvas={canvas} />;
}
