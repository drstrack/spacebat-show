import { getSql } from "@/lib/db";
import { show } from "@/data/show";
import { parsePostedShows, planAlertMorning, type PostedShow } from "@/lib/podcast-alert-plan";
import { scheduleChangeMorningAlert } from "@/lib/schedule-change";

const FRESH_MS = 6 * 60 * 60 * 1000;

type Person = { email: string; name: string };

export async function runPodcastAlerts(now = new Date()) {
  const response = await fetch(show.feedUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!response.ok) {
    const scheduleChange = await sendMovedWednesday(now);
    return { ok: false as const, error: "feed" as const, scheduleChange };
  }
  const xml = await response.text();
  const posted = parsePostedShows(xml);
  const { mails } = planAlertMorning(xml, now, origin());
  const sql = await getSql();

  const seeded = await sql<{ email: string }>`
    select email from alert_log where kind = 'seed' and ref = 'posted'
  `;
  if (!seeded.length) {
    for (const episode of posted) {
      const published = episode.publishedAt ? new Date(episode.publishedAt).getTime() : 0;
      if (!published || now.getTime() - published > FRESH_MS) {
        await remember("posted", episode.id, "*");
      }
    }
    await remember("seed", "posted", "*");
  }

  const people = await listeners();
  let morning = 0;
  let scheduleChange = 0;
  let postedCount = 0;

  for (const mail of mails) {
    const sent = await sendOnce(mail.kind, mail.ref, people, {
      subject: mail.subject,
      text: mail.text,
    });
    if (mail.kind === "show-day") morning += sent;
    else scheduleChange += sent;
  }
  for (const episode of posted) {
    postedCount += await sendOnce("posted", episode.id, people, postedNote(episode));
  }

  return { ok: true as const, morning, scheduleChange, posted: postedCount };
}

/** Skipped-morning note does not read the feed. A down Podhome response still sends it once. */
async function sendMovedWednesday(now: Date) {
  const change = scheduleChangeMorningAlert(now, origin());
  if (!change) return 0;
  return sendOnce(change.kind, change.ref, await listeners(), {
    subject: change.subject,
    text: change.text,
  });
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
) {
  const sql = await getSql();
  const sent = await sql<{ email: string }>`
    select email from alert_log where kind = ${kind} and ref = ${ref}
  `;
  if (sent.some((row) => row.email === "*")) return 0;
  const already = new Set(sent.map((row) => row.email.toLowerCase()));
  let count = 0;
  for (const person of people) {
    if (already.has(person.email)) continue;
    await sendAlert(person.email, note.subject, greeting(person.name) + note.text);
    await remember(kind, ref, person.email);
    count += 1;
  }
  return count;
}

async function remember(kind: string, ref: string, email: string) {
  const sql = await getSql();
  await sql`
    insert into alert_log (kind, ref, email)
    values (${kind}, ${ref}, ${email})
    on conflict (kind, ref, email) do nothing
  `;
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

async function sendAlert(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESET_FROM?.trim() || "SpaceBat Show <noreply@spacebatshow.net>";
  if (!key) throw new Error("Podcast alert email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: "spacebatshow@gmail.com",
      subject,
      text,
    }),
  });
  if (!response.ok) throw new Error("Could not send the podcast alert");
}
