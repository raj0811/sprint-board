/* eslint-disable @next/next/no-img-element -- logos are imgbb thumbnails. */
import { Avatar } from "@/components/ui/avatar";
import { ExpandableText } from "@/components/ui/expandable-text";
import { Icon } from "@/components/ui/icon";
import { initialsOf } from "@/lib/format";
import type { BoardData } from "@/lib/board-data";

const avatarColors = ["lavender", "mint", "peach", "sky", "plum"];

type ProjectOverviewProps = { project: NonNullable<BoardData["project"]>; team: BoardData["team"]; onOpenTeam: () => void; onEdit: () => void };

export function ProjectOverview({ project, team, onOpenTeam, onEdit }: ProjectOverviewProps) {
  const members = team?.members ?? [];
  return <section className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-3 lg:mb-7">
    {project.logo && <img src={project.logo.thumbUrl} alt={`${project.name} logo`} className="size-14 shrink-0 rounded-2xl border border-line bg-surface object-cover lg:size-16" />}
    <div className="min-w-0 flex-1">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Project{project.shared && <span className="rounded bg-brand-50 px-1.5 py-px normal-case tracking-normal text-brand-700">Shared with you</span>}</p>
      <div className="flex items-start gap-1">
        <h1 className="m-0 min-w-0 break-words text-2xl font-bold tracking-tight lg:text-[28px]">{project.name}</h1>
        <button onClick={onEdit} className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink" aria-label="Edit project" title="Edit project"><Icon name="edit" size={17} /></button>
      </div>
      {project.description && <ExpandableText key={project.id} text={project.description} lines={4} className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted" />}
    </div>
    <button onClick={onOpenTeam} className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface pl-2 pr-3 text-sm font-medium text-ink-soft hover:border-line-strong" aria-label={`Team: ${members.length} ${members.length === 1 ? "member" : "members"}`}>
      {members.length > 1
        ? <span className="flex -space-x-2">{members.slice(0, 3).map((member, index) => <span key={member.id} className="rounded-full ring-2 ring-surface"><Avatar initials={initialsOf(member.name)} color={avatarColors[index % avatarColors.length]} size="sm" /></span>)}</span>
        : <Icon name="users" size={17} />}
      {members.length > 3 && <span className="text-xs text-muted">+{members.length - 3}</span>}
      {team?.isOwner ? (members.length > 1 ? "Team" : "Invite") : "Team"}
    </button>
  </section>;
}
