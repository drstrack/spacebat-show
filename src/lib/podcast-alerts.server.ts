import { getSql } from "@/lib/db";
import { show } from "@/data/show";
import {
  alertFailureSummary,
  alertRunSummary,
  assessAlertHealth,
  classifyAlertError,
  deliverAlert,
  resendAlreadyAccepted,
  type AlertErrorClass,
  type DeliveryTally,
} from "@/lib/podcast-alert-delivery";
import { parsePostedShows, planAlertMorning, type PostedShow } from "@/lib/podcast-alert-plan";
import { alertDayPlan } from "@/lib/schedule-change";
import { listScheduleExceptions } from "@/lib/schedule-overrides.server";

const FRESH_MS = 6 * 60 * 60 * 1000;

type Person = { email: string; name: string };

export async function runPodcastAlerts(now = new Date()) {
  const exceptions = await listScheduleExceptions();
  let xml: string | null = null;
  let feed: "ok" | "down" = "ok";
  try {
    const response = await fetch(show.feedUrl, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!response.ok) feed = "down";
    else xml = await response.text();
  } catch {
    feed = "down";
  }

  const { mails } = planAlertMorning(xml, now, origin(), exceptions);
  const posted = xml ? parsePostedShows(xml) : [];

  if (xml) await seedPosted(posted, now);

  const people = await listeners();
  let showDay = 0;
  let scheduleChange = 0;
  let postedCount = 0;
  let skipped = 0;
  let errors = 0;
  let error: AlertErrorClass | null = null;
  const tally = (result: DeliveryTally, bucket: "show-day" | "schedule-change" | "posted") => {
    if (bucket === "show-day") showDay += result.sent;
    else if (bucket === "schedule-change") scheduleChange += result.sent;
    else postedCount += result.sent;
    skipped += result.skipped;
    errors += result.errors;
    if (result.error) error ??= result.error;
  };

  for (const mail of mails) {
    const result = await sendOnce(mail.kind, mail.ref, people, {
      subject: mail.subject,
      text: mail.text,
    });
    tally(result, mail.kind === "show-day" ? "show-day" : "schedule-change");
  }

  if (xml) {
    for (const episode of posted) {
      try {
        const result = await sendOnce("posted", episode.id, people, postedNote(episode));
        tally(result, "posted");
      } catch (err) {
        errors += 1;
        error ??= classifyAlertError(err);
      }
    }
  }

  const day = alertDayPlan(now, exceptions);
  let sent = 0;
  if (day) {
    const kind = day.kind;
    const ref = day.kind === "schedule-change" ? day.exception.skipDate : day.date;
    try {
      sent = await sentCount(kind, ref);
    } catch (err) {
      errors += 1;
      error ??= classifyAlertError(err);
    }
  }
  const health = assessAlertHealth({
    now,
    exceptions,
    sent,
    recipients: people.length,
    runError: error,
  });
  const summary = alertRunSummary({
    planned: mails.length,
    showDay,
    scheduleChange,
    posted: postedCount,
    skipped,
    errors,
    error,
    feed,
    health,
  });
  console.log(summary);
  return {
    ok: errors === 0,
    morning: showDay,
    scheduleChange,
    posted: postedCount,
    skipped,
    errors,
    error,
    feed,
    delivery: health.delivery,
    date: health.date,
    sent: health.sent,
    expected: health.expected,
    summary,
  };
}

export async function readAlertHealth(now = new Date()) {
  const exceptions = await listScheduleExceptions();
  const day = alertDayPlan(now, exceptions);
  const people = await listeners();
  let sent = 0;
  if (day) {
    const ref = day.kind === "schedule-change" ? day.exception.skipDate : day.date;
    sent = await sentCount(day.kind, ref);
  }
  return assessAlertHealth({
    now,
    exceptions,
    sent,
    recipients: people.length,
  });
}

export function logAlertFailure(now: Date, err: unknown): string {
  const summary = alertFailureSummary(now, classifyAlertError(err));
  console.log(summary);
  return summary;
}

async function seedPosted(posted: PostedShow[], now: Date) {
  const sql = await getSql();
  const seeded = await sql<{ email: string }>`
    select email from alert_log where kind = 'seed' and ref = 'posted'
  `;
  if (seeded.length) return;
  for (const episode of posted) {
    const published = episode.publishedAt ? new Date(episode.publishedAt).getTime() : 0;
    if (!published || now.getTime() - published > FRESH_MS) {
      await remember("posted", episode.id, "*");
    }
  }
  await remember("seed", "posted", "*");
}

async function listeners(): Promise<Person[]> {
  const sql = await getSql();
  const rows = await sql<{ email: string; name: string }>`
    select u.email as email, u.name as name
    from member_profile m
    join "user" u on u.id = m.user_id
    where m.podcast_alerts
  `;
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const row of rows) {
    const email = (row.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    people.push({ email, name: (row.name ?? "").trim() });
  }
  return people;
}

async function sendOnce(
  kind: string,
  ref: string,
  people: Person[],
  note: { subject: string; text: string },
): Promise<DeliveryTally> {
  const sql = await getSql();
  const sent = await sql<{ email: string }>`
    select email from alert_log where kind = ${kind} and ref = ${ref}
  `;
  const byEmail = new Map(people.map((person) => [person.email, person]));
  return deliverAlert({
    people,
    alreadyLogged: sent.map((row) => row.email),
    claim: async (email) => {
      const rows = await sql<{ email: string }>`
        insert into alert_log (kind, ref, email)
        values (${kind}, ${ref}, ${email})
        on conflict (kind, ref, email) do nothing
        returning email
      `;
      return rows.length > 0;
    },
    send: (email) => {
      const person = byEmail.get(email);
      return sendAlert(
        email,
        note.subject,
        greeting(person?.name ?? "") + note.text,
        `${kind}/${ref}/${email}`,
      );
    },
    release: async (email) => {
      await sql`
        delete from alert_log
        where kind = ${kind} and ref = ${ref} and email = ${email}
      `;
    },
  });
}

async function remember(kind: string, ref: string, email: string) {
  const sql = await getSql();
  await sql`
    insert into alert_log (kind, ref, email)
    values (${kind}, ${ref}, ${email})
    on conflict (kind, ref, email) do nothing
  `;
}

async function sentCount(kind: string, ref: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number | string | bigint }>`
    select count(*) as n from alert_log
    where kind = ${kind} and ref = ${ref} and email <> '*'
  `;
  return Number(rows[0]?.n ?? 0);
}

function origin() {
  return (process.env.BETTER_AUTH_URL?.trim() || "https://www.spacebatshow.net").replace(/\/$/, "");
}

function greeting(name: string) {
  const first = name.split(/\s+/)[0];
  return first && first.toLowerCase() !== "listener" ? `${first},\n\n` : "";
}

function postedNote(episode: PostedShow) {
  const site = origin();
  return {
    subject: `New SpaceBat episode: ${episode.title}`,
    text:
      `A new SpaceBat episode is posted.\n\n` +
      `${episode.title}\n` +
      `${site}/podcast/${episode.slug}\n\n` +
      `You asked for podcast alerts. Turn them off in your account:\n${site}/account\n`,
  };
}

async function sendAlert(to: string, subject: string, text: string, idempotencyKey: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESET_FROM?.trim() || "SpaceBat Show <noreply@spacebatshow.net>";
  if (!key) throw new Error("Podcast alert email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: "spacebatshow@gmail.com",
      subject,
      text,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // The key was already accepted with this night's earlier copy. Count it sent.
    if (resendAlreadyAccepted(response.status, body)) return;
    const error = new Error("Could not send the podcast alert") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
}
