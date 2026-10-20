import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  adminBan,
  adminDeleteMessage,
  adminMute,
  reportMessage,
} from "@/lib/chat/moderation.functions";
import { MUTE_1H_MINUTES, MUTE_24H_MINUTES, REPORT_REASONS } from "@/lib/chat/moderation";

const REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: "Spam",
  harassment: "Harassment",
  "personal-info": "Personal info",
  other: "Other",
};

function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

export function MessageMenu({
  messageId,
  authorId,
  isAdmin,
  onRemove,
  onError,
  onNotice,
}: {
  messageId: number;
  authorId?: string;
  isAdmin: boolean;
  onRemove: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("spam");
  const [note, setNote] = useState("");
  const [banReason, setBanReason] = useState("");
  const [purge, setPurge] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  async function onReport(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await reportMessage({ data: { messageId, reason, note } });
      setReportOpen(false);
      setNote("");
      onNotice(result.hidden ? "Reported. It's hidden until a host checks it." : "Reported.");
      if (result.hidden) onRemove();
    } catch (err) {
      onError(errorText(err, "Couldn’t report that."));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await adminDeleteMessage({ data: { id: messageId } });
      onRemove();
    } catch (err) {
      onError(errorText(err, "Couldn’t remove that."));
    } finally {
      setBusy(false);
    }
  }

  async function onMute(minutes: 60 | 1440) {
    if (!authorId) return;
    setBusy(true);
    try {
      await adminMute({ data: { userId: authorId, minutes } });
      onNotice(minutes === MUTE_1H_MINUTES ? "Muted for 1 hour." : "Muted for 24 hours.");
    } catch (err) {
      onError(errorText(err, "Couldn’t mute them."));
    } finally {
      setBusy(false);
    }
  }

  async function onBan(event: FormEvent) {
    event.preventDefault();
    if (!authorId) return;
    setBusy(true);
    try {
      await adminBan({ data: { userId: authorId, reason: banReason, purge } });
      setBanOpen(false);
      setBanReason("");
      setPurge(false);
      onNotice(purge ? "Banned, and the last 24 hours are removed." : "Banned.");
      if (purge) onRemove();
    } catch (err) {
      onError(errorText(err, "Couldn’t ban them."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <details ref={menuRef} className="relative">
        <summary className="cursor-pointer list-none text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          ⋯
        </summary>
        <div className="absolute right-0 z-20 mt-1 flex min-w-36 flex-col border-4 border-ink bg-paper p-1 shadow-[4px_4px_0_0_var(--color-ink)]">
          <button
            type="button"
            className="px-2 py-1 text-left text-sm hover:bg-caption"
            onClick={() => {
              closeMenu();
              setReportOpen(true);
            }}
          >
            Report
          </button>
          {isAdmin ? (
            <>
              <button
                type="button"
                className="px-2 py-1 text-left text-sm hover:bg-caption"
                disabled={busy}
                onClick={() => {
                  closeMenu();
                  void onDelete();
                }}
              >
                Delete
              </button>
              {authorId ? (
                <>
                  <button
                    type="button"
                    className="px-2 py-1 text-left text-sm hover:bg-caption"
                    disabled={busy}
                    onClick={() => {
                      closeMenu();
                      void onMute(MUTE_1H_MINUTES);
                    }}
                  >
                    Mute 1h
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-left text-sm hover:bg-caption"
                    disabled={busy}
                    onClick={() => {
                      closeMenu();
                      void onMute(MUTE_24H_MINUTES);
                    }}
                  >
                    Mute 24h
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-left text-sm hover:bg-caption"
                    onClick={() => {
                      closeMenu();
                      setBanOpen(true);
                    }}
                  >
                    Ban…
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </details>

      <Dialog.Root open={reportOpen} onOpenChange={setReportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border-4 border-ink bg-ivory p-4 shadow-[6px_6px_0_0_var(--color-ink)]">
            <Dialog.Title className="font-display text-3xl tracking-wide">Report</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              Hosts see the reason. The room never shows your email.
            </Dialog.Description>
            <form onSubmit={onReport} className="mt-3 space-y-3">
              <div className="space-y-1">
                {REPORT_REASONS.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="report-reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                    />
                    {REASON_LABELS[value]}
                  </label>
                ))}
              </div>
              <label className="block text-sm">
                Note, optional
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={200}
                  rows={3}
                  className="mt-1 w-full resize-none border-4 border-ink bg-paper px-2 py-1 text-sm"
                />
              </label>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "Sending" : "Report"}
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" size="sm" variant="ghost">
                    Cancel
                  </Button>
                </Dialog.Close>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={banOpen} onOpenChange={setBanOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border-4 border-ink bg-ivory p-4 shadow-[6px_6px_0_0_var(--color-ink)]">
            <Dialog.Title className="font-display text-3xl tracking-wide">Ban</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              They won’t be able to read or post until you unban them.
            </Dialog.Description>
            <form onSubmit={onBan} className="mt-3 space-y-3">
              <label className="block text-sm">
                Reason
                <textarea
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value)}
                  maxLength={200}
                  required
                  rows={3}
                  className="mt-1 w-full resize-none border-4 border-ink bg-paper px-2 py-1 text-sm"
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={purge}
                  onChange={(event) => setPurge(event.target.checked)}
                />
                Also remove their last 24h of messages
              </label>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "Banning" : "Ban"}
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" size="sm" variant="ghost">
                    Cancel
                  </Button>
                </Dialog.Close>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
