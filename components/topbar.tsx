import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type TopbarProps = { projectName?: string; onOpenMenu: () => void };

export function Topbar({ projectName, onOpenMenu }: TopbarProps) {
  return <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-6 lg:h-16 lg:px-10">
    <button onClick={onOpenMenu} className="grid size-10 place-items-center rounded-lg text-ink-soft hover:bg-canvas lg:hidden" aria-label="Open projects menu"><Icon name="menu" size={20} /></button>
    <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
      <span className="hidden sm:inline">Projects</span>
      {projectName && <><Icon name="chev" size={14} className="hidden shrink-0 sm:block" /><strong className="truncate font-semibold text-ink">{projectName}</strong></>}
    </div>
    <ThemeToggle className="ml-auto size-10" />
  </header>;
}
