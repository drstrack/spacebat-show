import { createServerFn } from "@tanstack/react-start";
import { dbSource, getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSessionUser } from "@/lib/auth/verify.server";

export type MemberLists = {
  podcastAlerts: boolean;
  showLetter: boolean;
  merchLetter: boolean;
};

export type AccountView = {
  email: string | null;
  name: string;
  role: "admin" | "listener";
  lists: MemberLists;
  durable: boolean;
};

type ProfileRow = {
  role: string;
  podcast_alerts: boolean;
  show_letter: boolean;
  merch_letter: boolean;
  name?: string;
  email?: string;
  created_at?: string | Date;
};

function stamp() {
  return new Date().toISOString();
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function dateAgo(days: number) {
  return daysAgo(days).slice(0, 10);
}

function adminEmails(): Set<string> {
  const extra = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set(["spacebatshow@gmail.com", ...extra]);
}

function roleFor(email: string | null): "admin" | "listener" {
  return email && adminEmails().has(email.toLowerCase()) ? "admin" : "listener";
}

function listsFrom(row: ProfileRow): MemberLists {
  return {
    podcastAlerts: Boolean(row.podcast_alerts),
    showLetter: Boolean(row.show_letter),
    merchLetter: Boolean(row.merch_letter),
  };
}

async function upsertProfile(userId: string, email: string | null, lists?: MemberLists) {
  const sql = await getSql();
  const role = roleFor(email);
  const podcast = lists?.podcastAlerts ?? true;
  const show = lists?.showLetter ?? false;
  const merch = lists?.merchLetter ?? false;
  const rows = lists
    ? await sql<ProfileRow>`
        insert into member_profile (user_id, role, podcast_alerts, show_letter, merch_letter)
        values (${userId}, ${role}, ${podcast}, ${show}, ${merch})
        on conflict (user_id) do update set
          role = case when excluded.role = 'admin' then 'admin' else member_profile.role end,
          podcast_alerts = excluded.podcast_alerts,
          show_letter = excluded.show_letter,
          merch_letter = excluded.merch_letter,
          updated_at = ${stamp()}
        returning role, podcast_alerts, show_letter, merch_letter
      `
    : await sql<ProfileRow>`
        insert into member_profile (user_id, role)
        values (${userId}, ${role})
        on conflict (user_id) do update set
          role = case when excluded.role = 'admin' then 'admin' else member_profile.role end,
          updated_at = ${stamp()}
        returning role, podcast_alerts, show_letter, merch_letter
      `;
  return rows[0];
}

export const loadAccount = createServerFn({ method: "GET" }).handler(async (): Promise<AccountView | null> => {
  const session = await getSessionUser();
  if (!session) return null;
  const sql = await getSql();
  const users = await sql<{ name: string; email: string }>`
    select name, email from "user" where id = ${session.id}
  `;
  const user = users[0];
  const email = user?.email ?? session.email;
  const profile = await upsertProfile(session.id, email);
  if (!profile) return null;
  return {
    email,
    name: user?.name ?? "",
    role: profile.role === "admin" ? "admin" : "listener",
    lists: listsFrom(profile),
    durable: dbSource !== "pglite",
  };
});

export const saveLists = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: MemberLists) => {
    if (
      typeof input?.podcastAlerts !== "boolean" ||
      typeof input?.showLetter !== "boolean" ||
      typeof input?.merchLetter !== "boolean"
    ) {
      throw new Error("Choose the lists again.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const session = await getSessionUser();
  const profile = await upsertProfile(context.userId, session?.email ?? null, data);
  if (!profile) throw new Error("Couldn’t save that.");
  return { lists: listsFrom(profile) };
  });

export const recordPageView = createServerFn({ method: "POST" })
  .validator((path: string) => {
    const clean = path.split("?")[0]?.trim() ?? "";
    if (!clean.startsWith("/") || clean.length > 180 || clean.startsWith("/admin")) return "";
    return clean;
  })
  .handler(async ({ data }) => {
    if (!data) return { ok: false };
    const sql = await getSql();
    await sql`insert into page_view (path, day) values (${data}, ${dateAgo(0)})`;
    return { ok: true };
  });

export type Analytics = {
  members: number;
  podcastAlerts: number;
  showLetter: number;
  merchLetter: number;
  joinedWeek: number;
  visitsWeek: number;
  pages: { path: string; visits: number }[];
    people: {
    userId: string;
    name: string;
    email: string;
    role: string;
    podcastAlerts: boolean;
    showLetter: boolean;
    merchLetter: boolean;
    joined: string;
    locked: boolean;
  }[];
};

function joinedLabel(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

function countOf(row: { n?: unknown } | undefined) {
  return Number(row?.n ?? 0);
}

export const loadAnalytics = createServerFn({ method: "GET" }).handler(async (): Promise<Analytics | null> => {
  const session = await getSessionUser();
  if (!session) return null;
  const sql = await getSql();
  const mine = await sql<{ role: string }>`
    select role from member_profile where user_id = ${session.id}
  `;
  if (mine[0]?.role !== "admin") return null;

    const [members, alerts, letter, merch, joined, visits, pages, people] = await Promise.all([
      sql<{ n: number }>`select count(*) as n from member_profile`,
      sql<{ n: number }>`select count(*) as n from member_profile where podcast_alerts`,
      sql<{ n: number }>`select count(*) as n from member_profile where show_letter`,
      sql<{ n: number }>`select count(*) as n from member_profile where merch_letter`,
      sql<{ n: number }>`select count(*) as n from member_profile where created_at > ${daysAgo(7)}`,
      sql<{ n: number }>`select count(*) as n from page_view where day >= ${dateAgo(6)}`,
      sql<{ path: string; n: number }>`
        select path, count(*) as n from page_view
        where day >= ${dateAgo(6)}
        group by path
        order by n desc
        limit 8
      `,
      sql<{ user_id: string } & ProfileRow>`
        select m.user_id, u.name, u.email, m.role, m.podcast_alerts, m.show_letter, m.merch_letter, m.created_at
        from member_profile m
        join "user" u on u.id = m.user_id
        order by m.created_at desc
        limit 50
      `,
    ]);

    return {
      members: countOf(members[0]),
      podcastAlerts: countOf(alerts[0]),
      showLetter: countOf(letter[0]),
      merchLetter: countOf(merch[0]),
      joinedWeek: countOf(joined[0]),
      visitsWeek: countOf(visits[0]),
      pages: pages.map((page) => ({ path: page.path, visits: Number(page.n) })),
      people: people.map((person) => ({
        userId: person.user_id,
        name: person.name ?? "",
        email: person.email ?? "",
        role: person.role === "admin" ? "admin" : "listener",
        podcastAlerts: Boolean(person.podcast_alerts),
        showLetter: Boolean(person.show_letter),
        merchLetter: Boolean(person.merch_letter),
        joined: joinedLabel(person.created_at),
        locked: adminEmails().has((person.email ?? "").toLowerCase()),
      })),
    };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    userId: string;
    role?: "admin" | "listener";
    lists?: MemberLists;
    remove?: boolean;
  }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("Missing account.");
    if (input.role && input.role !== "admin" && input.role !== "listener") {
      throw new Error("Pick admin or listener.");
    }
    if (input.lists) {
      const lists = input.lists;
      if (
        typeof lists.podcastAlerts !== "boolean" ||
        typeof lists.showLetter !== "boolean" ||
        typeof lists.merchLetter !== "boolean"
      ) {
        throw new Error("Choose the lists again.");
      }
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const mine = await sql<{ role: string }>`
      select role from member_profile where user_id = ${context.userId}
    `;
    if (mine[0]?.role !== "admin") throw new Error("Crew only.");

    const rows = await sql<{ email: string; role: string }>`
      select u.email, m.role
      from member_profile m
      join "user" u on u.id = m.user_id
      where m.user_id = ${data.userId}
    `;
    const target = rows[0];
    if (!target) throw new Error("No such account.");
    const locked = adminEmails().has((target.email ?? "").toLowerCase());

    if (data.remove) {
      if (locked || data.userId === context.userId) throw new Error("That account stays.");
      await sql`delete from "user" where id = ${data.userId}`;
      return { ok: true };
    }

    if (data.role) {
      if (locked && data.role !== "admin") throw new Error("The show account stays admin.");
      if (data.userId === context.userId && data.role !== "admin") {
        throw new Error("You can’t remove your own admin access.");
      }
      await sql`
        update member_profile set role = ${data.role}, updated_at = ${stamp()}
        where user_id = ${data.userId}
      `;
    }

    if (data.lists) {
      await sql`
        update member_profile set
          podcast_alerts = ${data.lists.podcastAlerts},
          show_letter = ${data.lists.showLetter},
          merch_letter = ${data.lists.merchLetter},
          updated_at = ${stamp()}
        where user_id = ${data.userId}
      `;
    }

    return { ok: true };
  });

