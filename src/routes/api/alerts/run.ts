import { createFileRoute } from "@tanstack/react-router";

async function handle({ request }: { request: Request }) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return new Response("No.", { status: 401 });
  }
  const url = new URL(request.url);
  if (url.searchParams.get("accounts") === "1") {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ email: string; name: string; role: string | null }>`
      select u.email as email, u.name as name, m.role as role
      from "user" u
      left join member_profile m on m.user_id = u.id
      order by u.email
    `;
    return Response.json({
      count: rows.length,
      accounts: rows.map((row) => ({
        email: row.email,
        name: row.name,
        role: row.role,
      })),
    });
  }
  const { runPodcastAlerts } = await import("@/lib/podcast-alerts.server");
  try {
    const result = await runPodcastAlerts();
    return Response.json(result);
  } catch (error) {
    console.error("podcast alerts", error instanceof Error ? error.message : "failed");
    return Response.json({ ok: false }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/alerts/run")({
  server: {
    handlers: {
      GET: handle,
    },
  },
});
