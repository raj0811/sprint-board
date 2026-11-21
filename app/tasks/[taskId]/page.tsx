import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskDetailView } from "@/components/task/task-detail";
import { requireUser } from "@/lib/auth";
import { getTaskDetail } from "@/lib/task-detail";

export const metadata: Metadata = { title: "Task — Orbit" };

export default function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">Loading task…</main>}>
    {params.then(({ taskId }) => <TaskLoader taskId={taskId} />)}
  </Suspense>;
}

async function TaskLoader({ taskId }: { taskId: string }) {
  const user = await requireUser();
  const detail = await getTaskDetail(user.id, taskId);
  if (!detail) notFound();
  return <TaskDetailView detail={detail} user={user} />;
}
