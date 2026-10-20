import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminAddBlockword,
  adminRemoveBlockword,
  adminUnban,
  adminUnmute,
  listAudit,
  listBlockwords,
  listReports,
  listSanctions,
  resolveReport,
  type AuditEntry,
  type BlockwordEntry,
  type ReportGroup,
  type SanctionedMember,
} from "@/lib/chat/moderation.functions";
export const Route = createFileRoute("/admin/chat")({
  head: () => ({
    meta: [{ title: "SpaceBat Chat — Crew" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminChatPage,
});

function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return "That didn’t save.";
}

function formatWhen(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
}

function AdminChatPage() {
  const [reports, setReports] = useState<ReportGroup[] | null>(null);
  const [sanctions, setSanctions] = useState<SanctionedMember[] | null>(null);
  const [words, setWords] = useState<BlockwordEntry[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState("");
  const [word, setWord] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextReports, nextSanctions, nextWords, nextAudit] = await Promise.all([
        listReports(),
        listSanctions(),
        listBlockwords(),
        listAudit({ data: {} }),
      ]);
      setReports(nextReports);
      setSanctions(nextSanctions);
      setWords(nextWords);
      setAudit(nextAudit);
      setDenied(false);
    } catch (err) {
      const message = errorText(err);
      if (message === "Crew only." || message === "Unauthorized") setDenied(true);
      else setError(message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(id: string, work: () => Promise<unknown>) {
    setError("");
    setBusy(id);
    try {
      await work();
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
    }
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl tracking-wide">Crew only</h1>
        <p className="mt-3 text-sm text-muted">Sign in as an admin to moderate SpaceBat Chat.</p>
        <Link to="/admin" className="mt-6 inline-block font-display text-xl text-crimson hover:underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="caption-box">Back end</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">SpaceBat Chat</h1>
      <p className="mt-3 text-sm text-muted">
        <Link to="/admin" className="text-crimson hover:underline">
          Analytics
        </Link>
      </p>
      {error ? <p className="mt-4 text-sm text-crimson">{error}</p> : null}
      {reports == null ? <p className="mt-8 text-sm text-muted">Opening the desk…</p> : null}

      <section className="mt-10">
        <h2 className="font-display text-3xl tracking-wide">Reports</h2>
        {reports?.length === 0 ? <p className="mt-3 text-sm text-muted">No open reports.</p> : null}
        <ul className="mt-4 space-y-4">
          {reports?.map((group) => (
            <li key={group.messageId} className="border-4 border-ink bg-ivory p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-2xl tracking-wide">{group.handle}</span>
                <span className="text-xs text-muted">
                  {group.count} {group.count === 1 ? "report" : "reports"} ·{" "}
                  {formatWhen(group.firstReportMs)}
                  {group.hidden ? " · hidden" : ""}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{group.body}</p>
              <p className="mt-2 text-xs text-muted">{group.reasons.join(" · ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["dismiss", "Dismiss"],
                    ["delete", "Delete"],
                    ["delete-and-mute", "Delete and mute 1h"],
                    ["delete-and-ban", "Delete and ban"],
                    ["restore", "Restore"],
                  ] as const
                ).map(([action, label]) => (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={action === "restore" ? "secondary" : "ghost"}
                    disabled={busy === `${group.messageId}:${action}`}
                    onClick={() =>
                      void run(`${group.messageId}:${action}`, () =>
                        resolveReport({ data: { messageId: group.messageId, action } }),
                      )
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-3xl tracking-wide">Muted and banned</h2>
        {sanctions?.length === 0 ? <p className="mt-3 text-sm text-muted">Nobody is muted or banned.</p> : null}
        <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
          {sanctions?.map((person) => (
            <li key={person.userId} className="py-4">
              <p className="font-display text-2xl tracking-wide">{person.handle}</p>
              {person.email ? <p className="text-sm text-muted">{person.email}</p> : null}
              <p className="mt-1 text-sm">
                {person.mutedUntilMs != null ? `Muted until ${formatWhen(person.mutedUntilMs)}. ` : ""}
                {person.bannedMs != null
                  ? `Banned ${formatWhen(person.bannedMs)}${person.banReason ? `: ${person.banReason}` : ""}.`
                  : ""}
              </p>
              <div className="mt-3 flex gap-2">
                {person.mutedUntilMs != null ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === `unmute:${person.userId}`}
                    onClick={() =>
                      void run(`unmute:${person.userId}`, () =>
                        adminUnmute({ data: { userId: person.userId } }),
                      )
                    }
                  >
                    Unmute
                  </Button>
                ) : null}
                {person.bannedMs != null ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === `unban:${person.userId}`}
                    onClick={() =>
                      void run(`unban:${person.userId}`, () =>
                        adminUnban({ data: { userId: person.userId } }),
                      )
                    }
                  >
                    Unban
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-3xl tracking-wide">Blocked words</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run("add-word", async () => {
              await adminAddBlockword({ data: { word } });
              setWord("");
            });
          }}
        >
          <label className="block min-w-48 flex-1 text-sm">
            Add a word
            <Input
              className="mt-1"
              value={word}
              onChange={(event) => setWord(event.target.value)}
              autoComplete="off"
              maxLength={32}
            />
          </label>
          <Button type="submit" size="sm" disabled={busy === "add-word"}>
            Add
          </Button>
        </form>
        <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
          {words?.map((entry) => (
            <li key={`${entry.source}:${entry.word}`} className="flex items-center justify-between gap-3 py-3">
              <span className="text-sm">
                {entry.word}{" "}
                <span className="text-xs uppercase tracking-[0.12em] text-muted">
                  {entry.source === "default" ? "Built in" : "Room"}
                </span>
              </span>
              {entry.source === "room" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy === `word:${entry.word}`}
                  onClick={() =>
                    void run(`word:${entry.word}`, () => adminRemoveBlockword({ data: { word: entry.word } }))
                  }
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-3xl tracking-wide">Audit log</h2>
        {audit?.length === 0 ? <p className="mt-3 text-sm text-muted">No actions yet.</p> : null}
        <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
          {audit?.map((entry) => (
            <li key={entry.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-xl tracking-wide">{entry.action}</span>
                <time className="text-xs text-muted" dateTime={new Date(entry.createdMs).toISOString()}>
                  {formatWhen(entry.createdMs)}
                </time>
              </div>
              <p className="text-sm">
                {entry.actorHandle}
                {entry.actorEmail ? <span className="text-muted"> · {entry.actorEmail}</span> : null}
                {entry.targetHandle ? ` → ${entry.targetHandle}` : ""}
                {entry.targetEmail ? <span className="text-muted"> · {entry.targetEmail}</span> : null}
              </p>
              {entry.detail ? <p className="text-sm text-muted">{entry.detail}</p> : null}
              {entry.messageId != null ? (
                <p className="text-xs text-muted">Message {entry.messageId}</p>
              ) : null}
            </li>
          ))}
        </ul>
        {audit && audit.length >= 100 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-4"
            disabled={busy === "earlier-audit"}
            onClick={() => {
              const oldest = audit[audit.length - 1]?.id;
              if (!oldest) return;
              setBusy("earlier-audit");
              setError("");
              void listAudit({ data: { before: oldest } })
                .then((older) => setAudit((current) => [...(current ?? []), ...older]))
                .catch((err: unknown) => setError(errorText(err)))
                .finally(() => setBusy(""));
            }}
          >
            Load earlier
          </Button>
        ) : null}
      </section>
    </div>
  );
}
