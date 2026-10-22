import { useEffect, useId, useRef, useState } from "react";
import type { ChatOnlineMember } from "@/lib/chat/types";

function label(count: number): string {
  return count === 1 ? "1 online" : `${count} online`;
}

function Avatar({ handle, imageUrl }: { handle: string; imageUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = handle.trim().charAt(0).toUpperCase() || "?";
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="size-8 shrink-0 border-2 border-ink object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center border-2 border-ink bg-caption font-display text-sm leading-none"
    >
      {initial}
    </span>
  );
}

/** Header control. The list is the same poll that loads messages. */
export function OnlineMembers({ members }: { members: ChatOnlineMember[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={listId}
        className="inline-flex items-center gap-2 border-4 border-ink bg-ivory px-3 py-1.5 text-sm text-ink hover:bg-caption focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-[#1f8a3b]" />
        {label(members.length)}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={listId}
          role="dialog"
          aria-label="Online members"
          tabIndex={-1}
          className="z-30 border-4 border-ink bg-ivory p-2 shadow-[4px_4px_0_0_var(--color-ink)] focus-visible:outline-none max-[480px]:fixed max-[480px]:inset-x-3 max-[480px]:top-16 max-[480px]:max-h-[min(60dvh,24rem)] max-[480px]:overflow-y-auto min-[481px]:absolute min-[481px]:left-0 min-[481px]:top-full min-[481px]:mt-2 min-[481px]:max-h-72 min-[481px]:w-64 min-[481px]:overflow-y-auto"
        >
          <p className="px-1 pb-1 font-display text-lg tracking-wide">In the room</p>
          {members.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted">No one is here right now.</p>
          ) : (
            <ul>
              {members.map((member) => (
                <li key={member.handle} className="flex items-center gap-2 px-1 py-1.5">
                  <Avatar handle={member.handle} imageUrl={member.imageUrl} />
                  <span className="min-w-0 truncate font-display text-lg tracking-wide">
                    {member.handle}
                  </span>
                  {member.you ? <span className="shrink-0 text-xs text-muted">you</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
