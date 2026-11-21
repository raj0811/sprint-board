import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { getBoardData } from "@/lib/board-data";
import { requireUser } from "@/lib/auth";

export default function Home({ searchParams }: { searchParams: Promise<{ project?: string; sprint?: string }> }) {
  return <Suspense fallback={<WorkspaceLoading />}><AuthenticatedBoard searchParams={searchParams} /></Suspense>;
}

async function AuthenticatedBoard({ searchParams }: { searchParams: Promise<{ project?: string; sprint?: string }> }) {
  const user = await requireUser();
  const { project, sprint } = await searchParams;
  const board = await getBoardData(user.id, project, sprint);
  return <Dashboard board={board} user={user} />;
}

function WorkspaceLoading() {
  return <main className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">Loading your workspace…</main>;
}
