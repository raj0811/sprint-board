"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { send } from "@/lib/api-client";
import { initialsOf } from "@/lib/format";
import type { Team } from "@/lib/team";

type TeamDialogProps = { projectId: string; projectName: string; team: Team; currentUserId: string; onClose: () => void };

export function TeamDialog({ projectId, projectName, team, currentUserId, onClose }: TeamDialogProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const result = await send(`/api/projects/${projectId}/members`, "POST", { email: address }) as { error?: string; status?: string };
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setEmail("");
    setNotice(result.status === "added"
      ? `${address} now has access to this project.`
      : `Invite saved. Ask ${address} to sign up at ${window.location.origin} with this email and they'll get access automatically.`);
    router.refresh();
  }

  async function remove(url: string, confirmText: string, afterwards?: () => void) {
    if (!window.confirm(confirmText)) return;
    setError("");
    setNotice("");
    const result = await send(url, "DELETE");
    if (result.error) { setError(result.error); return; }
    if (afterwards) afterwards();
    else router.refresh();
  }

  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="team-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_20px_70px_#0000004d] sm:max-w-[520px] sm:rounded-2xl sm:p-6">
      <div className="mx-auto -mt-1 mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="mb-0.5 block truncate text-xs font-medium text-faint">{projectName}</span>
          <h2 id="team-title" className="m-0 text-lg font-semibold tracking-tight">Team</h2>
        </div>
        <button type="button" onClick={onClose} className="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label="Close"><Icon name="close" /></button>
      </div>

      {team.isOwner ? <form onSubmit={invite}>
        <label htmlFor="invite-email" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Invite by email</label>
        <div className="flex gap-2">
          <input id="invite-email" type="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-brand-200 focus:ring-2 focus:ring-brand-100 sm:text-sm" />
          <button type="submit" disabled={busy || !email.trim()} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="mail" size={16} />{busy ? "Inviting…" : "Invite"}</button>
        </div>
        <p className="mb-0 mt-2 text-xs leading-relaxed text-muted">Team members can see and edit every sprint, task, subtask and comment in this project. People who already have an account are added right away.</p>
      </form> : <p className="m-0 rounded-xl bg-sunken px-3 py-2.5 text-sm text-muted">You&apos;re a member of this project. Only the owner can invite or remove people.</p>}

      {notice && <p role="status" className="mb-0 mt-4 rounded-xl bg-success-soft px-3 py-2.5 text-sm text-success-ink">{notice}</p>}
      {error && <p role="alert" className="mb-0 mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">{error}</p>}

      <h3 className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-faint">Members · {team.members.length}</h3>
      <ul className="-mx-2 grid">
        {team.members.map((member) => {
          const isMe = member.id === currentUserId;
          return <li key={member.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-canvas">
            <Avatar initials={initialsOf(member.name)} color={member.role === "owner" ? "lavender" : "mint"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{member.name}{isMe && <span className="font-normal text-muted"> (you)</span>}</div>
              <div className="truncate text-xs text-muted">{member.email}</div>
            </div>
            {member.role === "owner"
              ? <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Owner</span>
              : isMe
                ? <button onClick={() => remove(`/api/projects/${projectId}/members/${member.id}`, `Leave “${projectName}”? You'll lose access until you're invited again.`, () => router.replace("/"))} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-danger-ink hover:bg-danger-soft">Leave</button>
                : team.isOwner && <button onClick={() => remove(`/api/projects/${projectId}/members/${member.id}`, `Remove ${member.name} from “${projectName}”?`)} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-muted hover:bg-danger-soft hover:text-danger-ink">Remove</button>}
          </li>;
        })}
      </ul>

      {team.isOwner && team.invites.length > 0 && <>
        <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-faint">Waiting to sign up · {team.invites.length}</h3>
        <ul className="-mx-2 grid">
          {team.invites.map((invite) => <li key={invite.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-canvas">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-faint"><Icon name="mail" size={15} /></span>
            <div className="min-w-0 flex-1 truncate text-sm text-ink-soft">{invite.email}</div>
            <span className="rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-ink">Pending</span>
            <button onClick={() => remove(`/api/projects/${projectId}/invites/${invite.id}`, `Cancel the invite for ${invite.email}?`)} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-danger-soft hover:text-danger-ink" aria-label={`Cancel invite for ${invite.email}`}><Icon name="close" size={15} /></button>
          </li>)}
        </ul>
      </>}
    </div>
  </div>;
}
