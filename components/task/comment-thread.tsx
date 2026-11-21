"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { initialsOf, timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/task-detail";

type CommentThreadProps = {
  comments: Comment[];
  currentUserId: string;
  compact?: boolean;
  placeholder?: string;
  onPost: (body: string) => Promise<string | null>;
  onDelete: (comment: Comment) => void;
};

export function CommentThread({ comments, currentUserId, compact = false, placeholder = "Write a comment…", onPost, onDelete }: CommentThreadProps) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    const message = await onPost(draft.trim());
    if (message) setError(message);
    else setDraft("");
    setBusy(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  return <div className={compact ? "grid gap-3" : "grid gap-4"}>
    {comments.length > 0 && <ul className={`grid ${compact ? "gap-3" : "gap-4"}`}>
      {comments.map((comment) => <li key={comment.id} className="group/comment flex gap-2.5">
        <Avatar initials={initialsOf(comment.authorName)} color="plum" size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-ink">{comment.authorName}</span>
            <time suppressHydrationWarning dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()} className="shrink-0 text-xs text-faint">{timeAgo(comment.createdAt)}</time>
            {comment.authorId === currentUserId && <button onClick={() => onDelete(comment)} className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-faint transition-opacity hover:bg-danger-soft hover:text-danger-ink focus:opacity-100 can-hover:opacity-0 can-hover:group-hover/comment:opacity-100" aria-label="Delete comment"><Icon name="trash" size={14} /></button>}
          </div>
          <p className="mb-0 mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">{comment.body}</p>
        </div>
      </li>)}
    </ul>}

    <form onSubmit={submit} className="rounded-xl border border-line bg-surface focus-within:border-brand-200 focus-within:ring-2 focus-within:ring-brand-100">
      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} rows={compact ? 1 : 2} placeholder={placeholder} aria-label={placeholder} className="block w-full resize-none rounded-xl bg-transparent px-3 pt-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint sm:text-sm" />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <span className="hidden pl-1 text-[11px] text-faint sm:inline">Ctrl + Enter to post</span>
        <button type="submit" disabled={!draft.trim() || busy} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="send" size={13} />{busy ? "Posting…" : "Comment"}</button>
      </div>
    </form>
    {error && <p role="alert" className="m-0 text-xs text-danger-ink">{error}</p>}
  </div>;
}
