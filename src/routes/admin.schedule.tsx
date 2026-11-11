import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteScheduleAdmin, loadScheduleAdmin, saveScheduleAdmin } from "@/lib/schedule-overrides.functions";
import type { ScheduleException } from "@/lib/schedule-exceptions";

export const Route = createFileRoute("/admin/schedule")({
  loader: () => loadScheduleAdmin(),
  staleTime: 0,
  preloadStaleTime: 0,
  component: SchedulePage,
});

function SchedulePage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [skipDate, setSkipDate] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [showDate, setShowDate] = useState("");
  const [time, setTime] = useState("20:30");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data.canManage) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl tracking-wide">Crew only</h1>
        <p className="mt-3 text-sm text-muted">Sign in as an admin to move or cancel a show night.</p>
        <Link to="/login" className="mt-6 inline-block font-display text-xl text-crimson hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const [hourText, minuteText] = time.split(":");
    try {
      await saveScheduleAdmin({
        data: {
          skipDate,
          cancelled,
          showDate,
          hour: Number(hourText),
          minute: Number(minuteText),
          note,
        },
      });
      setSkipDate("");
      setShowDate("");
      setNote("");
      setCancelled(false);
      setTime("20:30");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(date: string) {
    setError("");
    setBusy(true);
    try {
      await deleteScheduleAdmin({ data: { skipDate: date } });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="caption-box">Back end</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">Show schedule</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        The show is live every Wednesday at 8:30 PM ET. Leave this page alone on a normal week.
        A move skips one date and mails “We’re on today” on the new night. A cancellation mails
        “No live show tonight” on the skipped morning and nothing else. The row drops out on its
        own at midnight ET the day after.
      </p>
      <p className="mt-4">
        <Link to="/admin" className="font-display text-xl tracking-wide text-crimson hover:underline">
          Back end
        </Link>
      </p>
      {error ? <p className="mt-4 text-sm text-crimson">{error}</p> : null}
      <ul className="mt-8 divide-y-2 divide-ink border-y-4 border-ink">
        {data.overrides.length === 0 ? (
          <li className="py-4 text-sm text-muted">No moves or cancellations.</li>
        ) : (
          data.overrides.map((row) => (
            <li key={row.skipDate} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div>
                <p className="font-display text-2xl tracking-wide">Skip {row.skipDate}</p>
                <p className="mt-1 text-sm text-ink">{label(row)}</p>
                <p className="mt-1 text-sm text-muted">{row.note}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => remove(row.skipDate)}>
                Remove
              </Button>
            </li>
          ))
        )}
      </ul>
      <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm">
          Date with no regular show
          <Input type="date" required value={skipDate} onChange={(event) => setSkipDate(event.target.value)} />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={cancelled}
            onChange={(event) => setCancelled(event.target.checked)}
          />
          Cancel that night. No replacement show.
        </label>
        {cancelled ? null : (
          <>
            <label className="grid gap-2 text-sm">
              Replacement date
              <Input type="date" required value={showDate} onChange={(event) => setShowDate(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm">
              Replacement time, America/New_York
              <Input type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </>
        )}
        <label className="grid gap-2 text-sm">
          Note for the site and the email. Leave blank for the standard sentence.
          <textarea
            value={note}
            maxLength={280}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-24 w-full rounded-xs border-4 border-ink bg-ivory px-4 py-3 text-base text-ink shadow-[4px_4px_0_0_var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving" : "Save schedule change"}
        </Button>
      </form>
    </div>
  );
}

function label(row: ScheduleException): string {
  if (!row.showStart) return "Cancelled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(row.showStart));
}
